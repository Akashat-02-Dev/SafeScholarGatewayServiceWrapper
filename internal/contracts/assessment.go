package contracts

import (
	"errors"
	"strings"
	"time"
)

const (
	maxAssessmentQuestions = 200
	maxAssessmentAnswers   = 400
	maxQuestionChoices     = 20
)

type AssessmentRequest struct {
	AssessmentID string `json:"assessmentId"`
}

func (r AssessmentRequest) Validate() error {
	_, err := validateID("assessmentId", r.AssessmentID)
	return err
}

type AssessmentStatus string

const (
	AssessmentStatusDraft     AssessmentStatus = "draft"
	AssessmentStatusPublished AssessmentStatus = "published"
	AssessmentStatusArchived  AssessmentStatus = "archived"
)

type Assessment struct {
	AssessmentID  string               `json:"assessmentId"`
	InstitutionID string               `json:"institutionId,omitempty"`
	Title         string               `json:"title"`
	Instructions  string               `json:"instructions,omitempty"`
	Status        AssessmentStatus     `json:"status"`
	Questions     []AssessmentQuestion `json:"questions,omitempty"`
	CreatedAt     time.Time            `json:"createdAt,omitempty"`
	UpdatedAt     time.Time            `json:"updatedAt,omitempty"`
}

func (a Assessment) Validate() error {
	if _, err := validateID("assessmentId", a.AssessmentID); err != nil {
		return err
	}
	if a.InstitutionID != "" {
		if _, err := validateID("institutionId", a.InstitutionID); err != nil {
			return err
		}
	}
	if _, err := validateTitle("title", a.Title); err != nil {
		return err
	}
	if a.Instructions != "" {
		if _, err := validateLongText("instructions", a.Instructions); err != nil {
			return err
		}
	}
	if a.Status != "" {
		if a.Status != AssessmentStatusDraft && a.Status != AssessmentStatusPublished && a.Status != AssessmentStatusArchived {
			return errors.New("invalid status")
		}
	}
	if len(a.Questions) > maxAssessmentQuestions {
		return errors.New("too many questions")
	}
	for _, q := range a.Questions {
		if err := q.Validate(); err != nil {
			return err
		}
	}
	return nil
}

type QuestionType string

const (
	QuestionTypeSingleChoice QuestionType = "single_choice"
	QuestionTypeMultiChoice  QuestionType = "multi_choice"
	QuestionTypeShortAnswer  QuestionType = "short_answer"
	QuestionTypeLongAnswer   QuestionType = "long_answer"
)

type AssessmentQuestion struct {
	QuestionID string       `json:"questionId"`
	Prompt     string       `json:"prompt"`
	Type       QuestionType `json:"type"`
	Choices    []string     `json:"choices,omitempty"`
	MaxScore   int          `json:"maxScore,omitempty"`
	Required   bool         `json:"required"`
}

func (q AssessmentQuestion) Validate() error {
	if _, err := validateID("questionId", q.QuestionID); err != nil {
		return err
	}
	if _, err := validateShortText("prompt", q.Prompt); err != nil {
		return err
	}
	switch q.Type {
	case QuestionTypeSingleChoice, QuestionTypeMultiChoice, QuestionTypeShortAnswer, QuestionTypeLongAnswer:
	default:
		return errors.New("invalid question type")
	}
	if len(q.Choices) > maxQuestionChoices {
		return errors.New("too many choices")
	}
	for _, c := range q.Choices {
		if _, err := validateShortText("choice", c); err != nil {
			return err
		}
	}
	if q.Type == QuestionTypeSingleChoice || q.Type == QuestionTypeMultiChoice {
		if len(q.Choices) == 0 {
			return errors.New("choices required")
		}
	}
	if q.MaxScore < 0 || q.MaxScore > 1000 {
		return errors.New("invalid maxScore")
	}
	return nil
}

type CreateAssessmentRequest struct {
	Title        string               `json:"title"`
	Instructions string               `json:"instructions,omitempty"`
	Questions    []AssessmentQuestion `json:"questions"`
}

func (r CreateAssessmentRequest) Validate() error {
	if _, err := validateTitle("title", r.Title); err != nil {
		return err
	}
	if r.Instructions != "" {
		if _, err := validateLongText("instructions", r.Instructions); err != nil {
			return err
		}
	}
	if len(r.Questions) == 0 {
		return errors.New("questions required")
	}
	if len(r.Questions) > maxAssessmentQuestions {
		return errors.New("too many questions")
	}
	for _, q := range r.Questions {
		if err := q.Validate(); err != nil {
			return err
		}
	}
	return nil
}

type CreateAssessmentResponse struct {
	AssessmentID string `json:"assessmentId"`
}

func (r CreateAssessmentResponse) Validate() error {
	_, err := validateID("assessmentId", r.AssessmentID)
	return err
}

type SubmitAssessmentRequest struct {
	AssessmentID string                 `json:"assessmentId"`
	Answers      []AssessmentAnswerItem `json:"answers"`
	UserID       string                 `json:"userId,omitempty"`
}

func (r SubmitAssessmentRequest) Validate() error {
	if _, err := validateID("assessmentId", r.AssessmentID); err != nil {
		return err
	}
	if r.UserID != "" {
		if _, err := validateID("userId", r.UserID); err != nil {
			return err
		}
	}
	if len(r.Answers) == 0 {
		return errors.New("answers required")
	}
	if len(r.Answers) > maxAssessmentAnswers {
		return errors.New("too many answers")
	}
	for _, a := range r.Answers {
		if err := a.Validate(); err != nil {
			return err
		}
	}
	return nil
}

func (r SubmitAssessmentRequest) ValidateAgainstActor(actorUserID string) error {
	if err := r.Validate(); err != nil {
		return err
	}
	if r.UserID != "" && strings.TrimSpace(actorUserID) != "" {
		if strings.TrimSpace(r.UserID) != strings.TrimSpace(actorUserID) {
			return errors.New("userId mismatch")
		}
	}
	return nil
}

type AssessmentAnswerItem struct {
	QuestionID string   `json:"questionId"`
	Answer     string   `json:"answer,omitempty"`
	Choices    []string `json:"choices,omitempty"`
}

func (a AssessmentAnswerItem) Validate() error {
	if _, err := validateID("questionId", a.QuestionID); err != nil {
		return err
	}
	if a.Answer != "" {
		if _, err := validateLongText("answer", a.Answer); err != nil {
			return err
		}
	}
	if len(a.Choices) > maxQuestionChoices {
		return errors.New("too many choices")
	}
	for _, c := range a.Choices {
		if _, err := validateShortText("choice", c); err != nil {
			return err
		}
	}
	if strings.TrimSpace(a.Answer) == "" && len(a.Choices) == 0 {
		return errors.New("answer required")
	}
	return nil
}

type AssessmentResultRequest struct {
	AssessmentID string `json:"assessmentId"`
	UserID       string `json:"userId,omitempty"`
}

func (r AssessmentResultRequest) Validate() error {
	if _, err := validateID("assessmentId", r.AssessmentID); err != nil {
		return err
	}
	if r.UserID != "" {
		if _, err := validateID("userId", r.UserID); err != nil {
			return err
		}
	}
	return nil
}

func (r AssessmentResultRequest) ValidateAgainstActor(actorUserID string) error {
	if err := r.Validate(); err != nil {
		return err
	}
	if r.UserID != "" && strings.TrimSpace(actorUserID) != "" {
		if strings.TrimSpace(r.UserID) != strings.TrimSpace(actorUserID) {
			return errors.New("userId mismatch")
		}
	}
	return nil
}

type AssessmentResult struct {
	AssessmentID string    `json:"assessmentId"`
	UserID       string    `json:"userId,omitempty"`
	Score        int       `json:"score"`
	MaxScore     int       `json:"maxScore"`
	SubmittedAt  time.Time `json:"submittedAt,omitempty"`
}

func (r AssessmentResult) Validate() error {
	if _, err := validateID("assessmentId", r.AssessmentID); err != nil {
		return err
	}
	if r.UserID != "" {
		if _, err := validateID("userId", r.UserID); err != nil {
			return err
		}
	}
	if r.Score < 0 || r.MaxScore < 0 || r.Score > r.MaxScore {
		return errors.New("invalid score")
	}
	return nil
}
