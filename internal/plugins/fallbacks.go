package plugins

import (
	"fmt"
	"strings"
	"time"
)

// GenerateGracefulFallback generates a context-aware, structured Australian educational fallback payload
// so that student and educator UI views render safely without any crash or 500 error.
func GenerateGracefulFallback(pluginID string, params map[string]interface{}) (any, bool) {
	topic := "Curriculum Concepts"
	if t, ok := params["topic"].(string); ok && strings.TrimSpace(t) != "" {
		topic = strings.TrimSpace(t)
	} else if p, ok := params["prompt"].(string); ok && strings.TrimSpace(p) != "" {
		topic = strings.TrimSpace(p)
	}

	yearLevel := "Year 3"
	if y, ok := params["year_level"].(string); ok && strings.TrimSpace(y) != "" {
		yearLevel = strings.TrimSpace(y)
	} else if y, ok := params["grade"].(string); ok && strings.TrimSpace(y) != "" {
		yearLevel = strings.TrimSpace(y)
	}

	timestamp := time.Now().UTC().Format(time.RFC3339)

	switch pluginID {
	case "lesson_planner":
		return map[string]any{
			"fallback":    true,
			"resilience":  "circuit_breaker_active",
			"timestamp":   timestamp,
			"title":       fmt.Sprintf("Australian Curriculum Lesson Plan: %s (%s)", topic, yearLevel),
			"yearLevel":   yearLevel,
			"subject":     "Integrated Learning",
			"curriculumCodes": []string{"AC9M3N01", "AC9E3LY01"},
			"learningObjectives": []string{
				fmt.Sprintf("Understand core foundational ideas relating to %s.", topic),
				"Apply analytical questioning and collaborative inquiry.",
				"Demonstrate evidence of understanding through formative checkpoints.",
			},
			"phases": []map[string]any{
				{
					"phase":    "Warm-Up / Engagement (10 mins)",
					"activity": fmt.Sprintf("Introductory think-pair-share discussing prior knowledge of %s.", topic),
				},
				{
					"phase":    "Explicit Instruction & Guided Practice (25 mins)",
					"activity": fmt.Sprintf("Teacher modelling of foundational %s concepts with scaffolded examples.", topic),
				},
				{
					"phase":    "Independent Application (20 mins)",
					"activity": "Students complete differentiated inquiry worksheet or peer problem-solving tasks.",
				},
				{
					"phase":    "Reflection & Plenary (5 mins)",
					"activity": "Exit ticket capturing one new key takeaway and one inquiry question for next session.",
				},
			},
			"differentiation": map[string]string{
				"support":   "Visual cue cards, vocabulary word wall, and structured sentence starters.",
				"extension": "Open-ended inquiry prompts applying concepts to real-world Australian contexts.",
			},
			"notice": "Generated via SafeScholar Resilient Offline Engine while upstream AI services recover.",
		}, true

	case "quiz_me", "quiz_generator":
		return map[string]any{
			"fallback":   true,
			"resilience": "circuit_breaker_active",
			"timestamp":  timestamp,
			"title":      fmt.Sprintf("Curriculum Mastery Check: %s", topic),
			"questions": []map[string]any{
				{
					"id":            1,
					"question":      fmt.Sprintf("Which of the following best describes the core principle of %s?", topic),
					"options":       []string{"It represents an essential curriculum concept", "It is an unverified assumption", "It applies only in laboratory experiments", "None of the above"},
					"correctAnswer": 0,
					"explanation":   fmt.Sprintf("In the Australian Curriculum framework, %s builds essential conceptual understanding.", topic),
				},
				{
					"id":            2,
					"question":      fmt.Sprintf("When investigating %s, what is the recommended first step in inquiry?", topic),
					"options":       []string{"Formulate a guiding question and assess prior knowledge", "Immediately draw final conclusions", "Ignore secondary sources", "Skip data collection"},
					"correctAnswer": 0,
					"explanation":   "Formulating guiding questions frames the inquiry cycle effectively.",
				},
				{
					"id":            3,
					"question":      fmt.Sprintf("How can students demonstrate mastery of %s in a classroom setting?", topic),
					"options":       []string{"Through clear explanation, practical examples, and peer review", "By memorising text without context", "By avoiding feedback", "None of the above"},
					"correctAnswer": 0,
					"explanation":   "Mastery is shown through clear reasoning, application, and peer discourse.",
				},
			},
			"notice": "Resilient offline quiz dataset provided while upstream AI services recover.",
		}, true

	case "socratic_tutor":
		return map[string]any{
			"fallback":   true,
			"resilience": "circuit_breaker_active",
			"timestamp":  timestamp,
			"response":   fmt.Sprintf("That is an intriguing inquiry about %s! Before I give you the full solution, what do you think is the very first clue or pattern you notice? Tell me what you already know, and let's explore it together step by step.", topic),
			"followUpQuestions": []string{
				"What part of this problem feels clearest to you?",
				"Can you break this down into two smaller steps?",
			},
			"notice": "Socratic dialog provided via SafeScholar Resilient Guidance Engine.",
		}, true

	case "writing_feedback":
		return map[string]any{
			"fallback":   true,
			"resilience": "circuit_breaker_active",
			"timestamp":  timestamp,
			"rubricScores": map[string]int{
				"ideasAndContent":    4,
				"structureAndFlow":   4,
				"grammarAndPunctuation": 4,
				"vocabularyChoice":   4,
			},
			"strengths": []string{
				"Clear focus and sincere engagement with the assigned topic.",
				"Good organization with clear paragraph progression.",
			},
			"areasForGrowth": []string{
				"Consider adding more vivid sensory adjectives or domain-specific vocabulary.",
				"Vary sentence openings to enhance rhythmic fluency throughout.",
			},
			"summary": "Great effort! Your writing demonstrates solid structural coherence. Continue revising with targeted descriptive language.",
			"notice":  "Formative assessment rubric provided via SafeScholar Resilient Engine.",
		}, true

	case "iep_generator":
		return map[string]any{
			"fallback":   true,
			"resilience": "circuit_breaker_active",
			"timestamp":  timestamp,
			"title":      fmt.Sprintf("Individualized Education Plan (IEP) Scaffolding: %s", topic),
			"yearLevel":  yearLevel,
			"goals": []string{
				fmt.Sprintf("Student will demonstrate understanding of key %s components with 80%% accuracy over 4 weeks.", topic),
				"Student will utilize visual organizers and chunked tasks during independent learning sessions.",
			},
			"accommodations": []string{
				"Provide chunked instructions and visual timers.",
				"Allow oral responses or speech-to-text assistive aids where appropriate.",
				"Offer frequent check-ins during transitional phases.",
			},
			"assessmentCriteria": "Formative observation checklists, modified rubric scales, and portfolio artifact reviews.",
			"notice":             "IEP scaffold provided via SafeScholar Resilient Offline Engine.",
		}, true

	case "worksheet_generator":
		return map[string]any{
			"fallback":   true,
			"resilience": "circuit_breaker_active",
			"timestamp":  timestamp,
			"title":      fmt.Sprintf("Curriculum Practice Worksheet: %s", topic),
			"yearLevel":  yearLevel,
			"instructions": "Read each prompt carefully and record your answers in complete sentences.",
			"sections": []map[string]any{
				{
					"sectionTitle": "Part A: Key Vocabulary & Conceptual Recall",
					"items": []string{
						fmt.Sprintf("Define in your own words what %s means.", topic),
						fmt.Sprintf("List two everyday examples where %s is observed.", topic),
					},
				},
				{
					"sectionTitle": "Part B: Critical Thinking & Application",
					"items": []string{
						fmt.Sprintf("Why is understanding %s valuable for our community and environment?", topic),
						"Create a diagram or concept sketch illustrating the relationship between key elements.",
					},
				},
			},
			"notice": "Printable worksheet scaffold provided via SafeScholar Resilient Engine.",
		}, true

	default:
		return map[string]any{
			"fallback":   true,
			"resilience": "circuit_breaker_active",
			"pluginId":   pluginID,
			"timestamp":  timestamp,
			"status":     "degraded",
			"message":    fmt.Sprintf("The feature '%s' is temporarily operating in resilient fallback mode while upstream services recover. Other system features remain 100%% operational.", pluginID),
		}, true
	}
}
