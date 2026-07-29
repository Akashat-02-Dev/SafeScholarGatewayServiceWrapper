package rbac

import "strings"

type PolicyEngine struct{}

func NewPolicyEngine() *PolicyEngine {
	return &PolicyEngine{}
}

func (p *PolicyEngine) Allowed(userPermissions []string, required string) bool {
	req := strings.ToUpper(strings.TrimSpace(required))
	if req == "" {
		return true
	}
	for _, perm := range userPermissions {
		v := strings.ToUpper(strings.TrimSpace(perm))
		if v == "SUPER_ADMIN" {
			return true
		}
		if v == req {
			return true
		}
		// Local tenant admins with MANAGE_LOCAL_ROLES inherit sub-permissions for local RBAC/User curation
		if v == "MANAGE_LOCAL_ROLES" {
			if req == "CREATE_ROLE" || req == "ASSIGN_ROLE" || req == "ASSIGN_PERMISSION" || req == "MANAGE_USERS" {
				return true
			}
		}
		// Users with MANAGE_USERS inherit sub-permissions for role assignments and list retrieval
		if v == "MANAGE_USERS" {
			if req == "CREATE_ROLE" || req == "ASSIGN_ROLE" {
				return true
			}
		}
		// Users with MANAGE_ROLES inherit sub-permissions for role creation and permission mapping
		if v == "MANAGE_ROLES" {
			if req == "CREATE_ROLE" || req == "ASSIGN_ROLE" || req == "ASSIGN_PERMISSION" {
				return true
			}
		}
	}
	return false
}

func (p *PolicyEngine) NormalizePermissions(perms []string) []string {
	out := make([]string, 0, len(perms))
	seen := map[string]struct{}{}
	for _, perm := range perms {
		v := strings.ToUpper(strings.TrimSpace(perm))
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}
