package trial

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"safescholar/gateway/infrastructure/database"
	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/security"
)

type TrialInstitute struct {
	InstitutionID  string     `json:"institutionId"`
	Name           string     `json:"name"`
	Domain         string     `json:"domain"`
	Status         string     `json:"status"`
	IsTrial        bool       `json:"isTrial"`
	TrialStatus    string     `json:"trialStatus"`
	TrialStartsAt  *time.Time `json:"trialStartsAt"`
	TrialEndsAt    *time.Time `json:"trialEndsAt"`
	MaxTeachers    int        `json:"maxTeachers"`
	MaxStudents    int        `json:"maxStudents"`
	ActiveTeachers int        `json:"activeTeachers"`
	ActiveStudents int        `json:"activeStudents"`
	DaysRemaining  int        `json:"daysRemaining"`
	CreatedAt      time.Time  `json:"createdAt"`
}

type OnboardTrialRequest struct {
	Name           string `json:"name"`
	Domain         string `json:"domain"`
	AdminEmail     string `json:"adminEmail"`
	AdminFirstName string `json:"adminFirstName"`
	AdminLastName  string `json:"adminLastName"`
	AdminPassword  string `json:"adminPassword"`
	DurationDays   int    `json:"durationDays"`
	MaxTeachers    int    `json:"maxTeachers"`
	MaxStudents    int    `json:"maxStudents"`
}

type ToggleTrialRequest struct {
	InstitutionID  string `json:"institutionId"`
	Action         string `json:"action"` // "pause", "resume", "extend", "update_limits", "delete"
	AdditionalDays int    `json:"additionalDays,omitempty"`
	MaxTeachers    int    `json:"maxTeachers,omitempty"`
	MaxStudents    int    `json:"maxStudents,omitempty"`
}

type TrialService struct {
	pool        *pgxpool.Pool
	auditLogger *security.AuditLogger
}

func NewTrialService(pool *pgxpool.Pool, auditLogger *security.AuditLogger) *TrialService {
	return &TrialService{
		pool:        pool,
		auditLogger: auditLogger,
	}
}

// ListTrialInstitutes lists all institutions with trial metadata (SysAdmin only)
func (s *TrialService) ListTrialInstitutes(ctx context.Context, isSysAdmin bool) ([]TrialInstitute, error) {
	if !isSysAdmin {
		return nil, errors.New("forbidden: super admin access required")
	}
	if s.pool == nil {
		return nil, errors.New("database pool unavailable")
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return nil, err
	}

	query := `
		select 
			i.institution_id::text,
			i.name,
			coalesce(i.domain, ''),
			i.status,
			coalesce(i.is_trial, false),
			coalesce(i.trial_status, 'none'),
			i.trial_starts_at,
			i.trial_ends_at,
			coalesce(i.max_teachers, 10),
			coalesce(i.max_students, 100),
			i.created_at,
			coalesce((
				select count(distinct ur.user_id)
				from user_roles ur
				join roles r on ur.role_id = r.role_id
				join users u on u.user_id = ur.user_id
				where u.institution_id = i.institution_id
				  and lower(r.name) in ('teacher', 'educator')
				  and u.status = 'active'
			), 0) as active_teachers,
			coalesce((
				select count(distinct ur.user_id)
				from user_roles ur
				join roles r on ur.role_id = r.role_id
				join users u on u.user_id = ur.user_id
				where u.institution_id = i.institution_id
				  and lower(r.name) = 'student'
				  and u.status = 'active'
			), 0) as active_students
		from institutions i
		order by i.created_at desc
	`

	rows, err := tx.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []TrialInstitute
	now := time.Now().UTC()

	for rows.Next() {
		var ti TrialInstitute
		var startsAt, endsAt *time.Time
		err := rows.Scan(
			&ti.InstitutionID,
			&ti.Name,
			&ti.Domain,
			&ti.Status,
			&ti.IsTrial,
			&ti.TrialStatus,
			&startsAt,
			&endsAt,
			&ti.MaxTeachers,
			&ti.MaxStudents,
			&ti.CreatedAt,
			&ti.ActiveTeachers,
			&ti.ActiveStudents,
		)
		if err != nil {
			return nil, err
		}

		ti.TrialStartsAt = startsAt
		ti.TrialEndsAt = endsAt

		if ti.IsTrial && endsAt != nil {
			if endsAt.Before(now) {
				ti.TrialStatus = "expired"
				ti.DaysRemaining = 0
			} else {
				ti.DaysRemaining = int(endsAt.Sub(now).Hours() / 24)
				if ti.DaysRemaining == 0 && endsAt.After(now) {
					ti.DaysRemaining = 1
				}
			}
		}

		result = append(result, ti)
	}

	return result, tx.Commit(ctx)
}

// OnboardTrialInstitute sets up a new trial institution with teacher/student quotas and duration between 7-30 days
func (s *TrialService) OnboardTrialInstitute(ctx context.Context, isSysAdmin bool, req OnboardTrialRequest) (*TrialInstitute, error) {
	if !isSysAdmin {
		return nil, errors.New("forbidden: super admin access required")
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("institution name is required")
	}

	// Validate duration: 7 to 30 days
	days := req.DurationDays
	if days < 7 {
		days = 7
	} else if days > 30 {
		days = 30
	}

	maxTeachers := req.MaxTeachers
	if maxTeachers <= 0 {
		maxTeachers = 10
	}

	maxStudents := req.MaxStudents
	if maxStudents <= 0 {
		maxStudents = 100
	}

	domain := strings.ToLower(strings.TrimSpace(req.Domain))
	if domain == "" {
		slug := strings.ToLower(strings.ReplaceAll(name, " ", "-"))
		domain = slug + ".safescholar.net"
	}

	now := time.Now().UTC()
	endsAt := now.AddDate(0, 0, days)

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return nil, err
	}

	var instID string
	err = tx.QueryRow(ctx, `
		insert into institutions(name, domain, status, is_trial, trial_status, trial_starts_at, trial_ends_at, max_teachers, max_students, created_at, updated_at)
		values ($1, $2, 'active', true, 'active', $3, $4, $5, $6, now(), now())
		returning institution_id::text
	`, name, domain, now, endsAt, maxTeachers, maxStudents).Scan(&instID)
	if err != nil {
		return nil, fmt.Errorf("failed to create institution: %w", err)
	}

	// Optional initial administrator account
	adminEmail := strings.ToLower(strings.TrimSpace(req.AdminEmail))
	if adminEmail != "" {
		pwd := req.AdminPassword
		if strings.TrimSpace(pwd) == "" {
			pwd = "SafeScholarTrial" + fmt.Sprintf("%d!", time.Now().Year())
		}
		if err := auth.DefaultPasswordPolicy().Validate(pwd); err != nil {
			pwd = "SafeScholar@2026!"
		}
		hash, err := security.HashPassword(pwd, security.DefaultArgon2idParams)
		if err == nil {
			var adminUserID string
			err = tx.QueryRow(ctx, `
				insert into users(institution_id, email, password_hash, first_name, last_name, status, is_sys_admin, created_at)
				values ($1::uuid, $2, $3, nullif($4,''), nullif($5,''), 'active', false, now())
				on conflict (email) do update set institution_id=excluded.institution_id, status='active'
				returning user_id::text
			`, instID, adminEmail, hash, strings.TrimSpace(req.AdminFirstName), strings.TrimSpace(req.AdminLastName)).Scan(&adminUserID)

			if err == nil {
				// Assign institute admin role
				var roleID string
				err = tx.QueryRow(ctx, `
					select role_id::text from roles 
					where (institution_id = $1::uuid or institution_id is null) 
					  and lower(name) in ('institute', 'admin', 'administrator') 
					limit 1
				`, instID).Scan(&roleID)
				if err == nil && roleID != "" {
					_, _ = tx.Exec(ctx, `
						insert into user_roles(user_id, role_id)
						values ($1::uuid, $2::uuid)
						on conflict do nothing
					`, adminUserID, roleID)
				}
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &TrialInstitute{
		InstitutionID:  instID,
		Name:           name,
		Domain:         domain,
		Status:         "active",
		IsTrial:        true,
		TrialStatus:    "active",
		TrialStartsAt:  &now,
		TrialEndsAt:    &endsAt,
		MaxTeachers:    maxTeachers,
		MaxStudents:    maxStudents,
		ActiveTeachers: 0,
		ActiveStudents: 0,
		DaysRemaining:  days,
		CreatedAt:      now,
	}, nil
}

// ToggleTrial manages trial lifecycle: pause, resume, extend, or update limits (SysAdmin only)
func (s *TrialService) ToggleTrial(ctx context.Context, isSysAdmin bool, req ToggleTrialRequest) error {
	if !isSysAdmin {
		return errors.New("forbidden: super admin access required")
	}
	instID := strings.TrimSpace(req.InstitutionID)
	if instID == "" {
		return errors.New("institutionId is required")
	}

	action := strings.ToLower(strings.TrimSpace(req.Action))

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return err
	}

	switch action {
	case "pause":
		_, err = tx.Exec(ctx, `
			update institutions
			set trial_status='paused', status='suspended', updated_at=now()
			where institution_id=$1::uuid and is_trial=true
		`, instID)
	case "resume":
		_, err = tx.Exec(ctx, `
			update institutions
			set trial_status='active', status='active', updated_at=now()
			where institution_id=$1::uuid and is_trial=true
		`, instID)
	case "extend":
		days := req.AdditionalDays
		if days <= 0 {
			days = 7
		}
		if days > 30 {
			days = 30
		}
		_, err = tx.Exec(ctx, `
			update institutions
			set trial_ends_at = greatest(now(), coalesce(trial_ends_at, now())) + ($2 || ' days')::interval,
			    trial_status='active',
			    status='active',
			    updated_at=now()
			where institution_id=$1::uuid and is_trial=true
		`, instID, days)
	case "update_limits":
		maxTeachers := req.MaxTeachers
		maxStudents := req.MaxStudents
		if maxTeachers <= 0 {
			maxTeachers = 10
		}
		if maxStudents <= 0 {
			maxStudents = 100
		}
		_, err = tx.Exec(ctx, `
			update institutions
			set max_teachers=$2, max_students=$3, updated_at=now()
			where institution_id=$1::uuid and is_trial=true
		`, instID, maxTeachers, maxStudents)
	case "delete":
		_, err = tx.Exec(ctx, `
			delete from institutions
			where institution_id=$1::uuid and is_trial=true
		`, instID)
	default:
		return fmt.Errorf("unknown action: %s", action)
	}

	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// ValidateTrialQuota verifies if an institution on trial is permitted to onboard/approve a member of a given role
func (s *TrialService) ValidateTrialQuota(ctx context.Context, institutionID, roleName string) error {
	instID := strings.TrimSpace(institutionID)
	if instID == "" {
		return nil // System level user or unassigned institution
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return err
	}

	var isTrial bool
	var trialStatus string
	var trialEndsAt *time.Time
	var maxTeachers, maxStudents int

	err = tx.QueryRow(ctx, `
		select coalesce(is_trial, false), coalesce(trial_status, 'none'), trial_ends_at, coalesce(max_teachers, 10), coalesce(max_students, 100)
		from institutions
		where institution_id=$1::uuid
	`, instID).Scan(&isTrial, &trialStatus, &trialEndsAt, &maxTeachers, &maxStudents)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}

	// Non-trial production institutions have zero restrictions!
	if !isTrial {
		return nil
	}

	// Trial status checks
	if trialStatus == "paused" {
		return errors.New("this institution's trial is currently paused. Please contact administrator")
	}

	now := time.Now().UTC()
	if trialEndsAt != nil && trialEndsAt.Before(now) {
		return errors.New("this institution's trial period has expired. Please contact administrator to extend or upgrade")
	}

	r := strings.ToLower(strings.TrimSpace(roleName))

	if r == "teacher" || r == "educator" {
		var activeTeachers int
		err = tx.QueryRow(ctx, `
			select count(distinct ur.user_id)
			from user_roles ur
			join roles ro on ur.role_id = ro.role_id
			join users u on u.user_id = ur.user_id
			where u.institution_id = $1::uuid
			  and lower(ro.name) in ('teacher', 'educator')
			  and u.status = 'active'
		`, instID).Scan(&activeTeachers)
		if err == nil && activeTeachers >= maxTeachers {
			return fmt.Errorf("trial teacher quota reached (maximum allowed: %d). Contact Super Admin to upgrade", maxTeachers)
		}
	} else if r == "student" {
		var activeStudents int
		err = tx.QueryRow(ctx, `
			select count(distinct ur.user_id)
			from user_roles ur
			join roles ro on ur.role_id = ro.role_id
			join users u on u.user_id = ur.user_id
			where u.institution_id = $1::uuid
			  and lower(ro.name) = 'student'
			  and u.status = 'active'
		`, instID).Scan(&activeStudents)
		if err == nil && activeStudents >= maxStudents {
			return fmt.Errorf("trial student quota reached (maximum allowed: %d). Contact Super Admin to upgrade", maxStudents)
		}
	}

	return nil
}
