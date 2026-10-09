import type { AssessmentSchema, AssessmentQuestion } from '../types/aios';

export interface AssignedAssessment {
  id: string;
  title: string;
  subject: string;
  gradeLevel: 'Prep' | 'Year 1' | 'Year 2' | 'Year 3' | 'Year 4' | 'Year 5';
  assessmentType: string;
  assignedByTeacherName: string;
  assignedByTeacherEmail: string;
  createdAt: string; // ISO string
  deadline: string; // ISO string
  timeLimitMinutes: number;
  totalMarks: number;
  instructions: string;
  alignedStandards: string[];
  questions: AssessmentQuestion[];
  status: 'active' | 'closed';
  isImmediateStart?: boolean;
}

export interface StudentTestSubmission {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentYearLevel: string;
  submittedAt: string; // ISO string
  earnedMarks: number;
  totalMarks: number;
  percentage: number;
  gradeBand: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  answers: Record<number, string>;
  timeSpentSeconds: number;
}

const STORAGE_KEY_TESTS = 'safescholar_assigned_assessments_roster';
const STORAGE_KEY_SUBMISSIONS = 'safescholar_test_submissions_roster';
const STORAGE_KEY_STUDENT_YEAR = 'safescholar_student_enrolled_year_level';

export const AUSTRALIAN_YEAR_LEVELS = [
  'Prep',
  'Year 1',
  'Year 2',
  'Year 3',
  'Year 4',
  'Year 5'
] as const;

export type AustralianYearLevel = typeof AUSTRALIAN_YEAR_LEVELS[number];

/**
 * Normalizes year level strings (e.g. "Prep / Foundation" -> "Prep", "Year 3 (NAPLAN Aligned)" -> "Year 3")
 */
export function normalizeYearLevel(raw: string): AustralianYearLevel {
  if (!raw) return 'Year 3';
  const lower = raw.toLowerCase().trim();
  if (lower.includes('prep') || lower.includes('foundation')) return 'Prep';
  if (lower.includes('year 1') || lower === '1') return 'Year 1';
  if (lower.includes('year 2') || lower === '2') return 'Year 2';
  if (lower.includes('year 3') || lower === '3') return 'Year 3';
  if (lower.includes('year 4') || lower === '4') return 'Year 4';
  if (lower.includes('year 5') || lower === '5') return 'Year 5';
  return 'Year 3';
}

/**
 * Checks whether an assessment's declared deadline has expired
 */
export function isDeadlineExpired(deadlineISO: string): boolean {
  if (!deadlineISO) return false;
  return new Date(deadlineISO).getTime() < Date.now();
}

/**
 * Formats friendly time remaining or expired message
 */
export function formatDeadlineRemaining(deadlineISO: string): { isExpired: boolean; text: string; badgeColor: string } {
  if (!deadlineISO) return { isExpired: false, text: 'No deadline set', badgeColor: 'bg-slate-100 text-slate-700' };
  
  const diffMs = new Date(deadlineISO).getTime() - Date.now();
  if (diffMs <= 0) {
    const expiredAgoHours = Math.abs(Math.round(diffMs / (1000 * 60 * 60)));
    return {
      isExpired: true,
      text: expiredAgoHours < 24 ? `Closed ${expiredAgoHours}h ago` : `Closed ${Math.round(expiredAgoHours / 24)}d ago`,
      badgeColor: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300'
    };
  }

  const hoursRemaining = Math.round(diffMs / (1000 * 60 * 60));
  if (hoursRemaining < 24) {
    return {
      isExpired: false,
      text: `Due in ${hoursRemaining} hours`,
      badgeColor: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
    };
  }

  const daysRemaining = Math.round(hoursRemaining / 24);
  return {
    isExpired: false,
    text: `Due in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`,
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
  };
}

// Initial Seed Data strictly aligned with Australian Curriculum Prep to Year 5
const INITIAL_ASSIGNED_TESTS: AssignedAssessment[] = [
  {
    id: 'test-y3-fractions',
    title: 'Year 3 Mathematics: Fractions & Number Line Mastery',
    subject: 'Mathematics (Numeracy)',
    gradeLevel: 'Year 3',
    assessmentType: 'Formative Checkpoint Quiz',
    assignedByTeacherName: 'Sarah Jenkins',
    assignedByTeacherEmail: 'sarah.jenkins@safescholar.edu.au',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), // Due in 2 days
    timeLimitMinutes: 15,
    totalMarks: 10,
    instructions: 'Read each fraction question carefully. Complete within the 15-minute exam window.',
    alignedStandards: ['AC9M3N01', 'AC9M3N02'],
    status: 'active',
    questions: [
      {
        id: 'q1',
        number: 1,
        question_text: 'Which fraction represents six out of eight equal slices of an Australian damper bread?',
        question_type: 'multiple_choice',
        options: ['6/8 (or 3/4)', '1/2', '2/8', '8/6'],
        correct_answer: '6/8 (or 3/4)',
        marks: 2,
        explanation: '6 out of 8 equal parts is 6/8. Dividing numerator and denominator by 2 simplifies to 3/4.',
        cognitive_verb: 'Identify'
      },
      {
        id: 'q2',
        number: 2,
        question_text: 'On a number line from 0 to 1 divided into quarters, how many quarters equal 1 whole?',
        question_type: 'multiple_choice',
        options: ['2 quarters', '3 quarters', '4 quarters', '8 quarters'],
        correct_answer: '4 quarters',
        marks: 2,
        explanation: 'Four fourths (4/4) equals 1 whole on the number line.',
        cognitive_verb: 'Recall'
      },
      {
        id: 'q3',
        number: 3,
        question_text: 'A wallaby hops 2 and a half metres in one jump. Write 2 and a half as a mixed numeral.',
        question_type: 'multiple_choice',
        options: ['2 1/2', '2 1/4', '3/2', '5/4'],
        correct_answer: '2 1/2',
        marks: 3,
        explanation: 'Two whole metres plus half a metre is represented as 2 1/2.',
        cognitive_verb: 'Represent'
      },
      {
        id: 'q4',
        number: 4,
        question_text: 'Which fraction is greater: 1/2 or 1/4?',
        question_type: 'multiple_choice',
        options: ['1/2 is greater', '1/4 is greater', 'They are equal', 'Cannot be determined'],
        correct_answer: '1/2 is greater',
        marks: 3,
        explanation: 'When dividing into fewer equal pieces (halves vs quarters), each piece is larger. 1/2 > 1/4.',
        cognitive_verb: 'Compare'
      }
    ]
  },
  {
    id: 'test-y4-science',
    title: 'Year 4 Science: Living & Non-Living Ecosystems Checkpoint',
    subject: 'Science (Biological Sciences)',
    gradeLevel: 'Year 4',
    assessmentType: 'Unit Assessment',
    assignedByTeacherName: 'David MacLeod',
    assignedByTeacherEmail: 'david.macleod@safescholar.edu.au',
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    deadline: new Date(Date.now() + 72 * 3600 * 1000).toISOString(), // Due in 3 days
    timeLimitMinutes: 20,
    totalMarks: 10,
    instructions: 'Demonstrate your understanding of Australian ecosystem habitats and living organism dependencies.',
    alignedStandards: ['AC9S4U01', 'AC9S4U02'],
    status: 'active',
    questions: [
      {
        id: 'q1',
        number: 1,
        question_text: 'Which of the following describes an observable life process found in all living organisms?',
        question_type: 'multiple_choice',
        options: ['Growth and response to stimuli', 'Rusting and weathering', 'Erosion', 'Magnetism'],
        correct_answer: 'Growth and response to stimuli',
        marks: 3,
        explanation: 'All living organisms grow, reproduce, and respond to their environment.',
        cognitive_verb: 'Explain'
      },
      {
        id: 'q2',
        number: 2,
        question_text: 'In an Australian billabong, eucalyptus leaves fall into the water. Which component is non-living?',
        question_type: 'multiple_choice',
        options: ['Water temperature and sunlight', 'Yabbies in the mud', 'River red gum trees', 'Microscopic pond algae'],
        correct_answer: 'Water temperature and sunlight',
        marks: 3,
        explanation: 'Water temperature, sunlight, and dissolved oxygen are abiotic (non-living) factors.',
        cognitive_verb: 'Classify'
      },
      {
        id: 'q3',
        number: 3,
        question_text: 'How do structural adaptations help koalas survive in eucalypt forests?',
        question_type: 'multiple_choice',
        options: ['Curved claws and strong limbs for climbing', 'Gills for underwater breathing', 'Bright feathers for courtship', 'Hollow bones for flight'],
        correct_answer: 'Curved claws and strong limbs for climbing',
        marks: 4,
        explanation: 'Koalas possess sharp curved claws and two opposable digits on their front paws to grip high branches safely.',
        cognitive_verb: 'Analyze'
      }
    ]
  },
  {
    id: 'test-prep-phonics',
    title: 'Prep / Foundation: Letters, Sounds & Sight Words',
    subject: 'English (Literacy & Phonics)',
    gradeLevel: 'Prep',
    assessmentType: 'Diagnostic Checkpoint',
    assignedByTeacherName: 'Sarah Jenkins',
    assignedByTeacherEmail: 'sarah.jenkins@safescholar.edu.au',
    createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    deadline: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // Due in 24h
    timeLimitMinutes: 10,
    totalMarks: 6,
    instructions: 'Tap the letter sound or picture that matches the question.',
    alignedStandards: ['AC9EFLA01', 'AC9EFLA02'],
    status: 'active',
    questions: [
      {
        id: 'q1',
        number: 1,
        question_text: 'Which letter makes the initial starting sound in "Kangaroo"?',
        question_type: 'multiple_choice',
        options: ['K', 'B', 'M', 'S'],
        correct_answer: 'K',
        marks: 2,
        explanation: 'K makes the /k/ sound at the start of Kangaroo.',
        cognitive_verb: 'Identify'
      },
      {
        id: 'q2',
        number: 2,
        question_text: 'Which rhyming word sounds like "Cat"?',
        question_type: 'multiple_choice',
        options: ['Hat', 'Dog', 'Sun', 'Tree'],
        correct_answer: 'Hat',
        marks: 2,
        explanation: 'Cat and Hat share the -at phonogram.',
        cognitive_verb: 'Match'
      },
      {
        id: 'q3',
        number: 3,
        question_text: 'What colour is the Australian sun in our classroom drawing?',
        question_type: 'multiple_choice',
        options: ['Yellow', 'Blue', 'Green', 'Purple'],
        correct_answer: 'Yellow',
        marks: 2,
        explanation: 'Yellow is the colour of the warm sun.',
        cognitive_verb: 'Recall'
      }
    ]
  },
  {
    id: 'test-expired-y3',
    title: 'Year 3 English: Term 1 Narrative Text Features (Closed)',
    subject: 'English Literacy',
    gradeLevel: 'Year 3',
    assessmentType: 'Past Checkpoint',
    assignedByTeacherName: 'Sarah Jenkins',
    assignedByTeacherEmail: 'sarah.jenkins@safescholar.edu.au',
    createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    deadline: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // Expired yesterday
    timeLimitMinutes: 15,
    totalMarks: 5,
    instructions: 'Narrative structure checkpoint.',
    alignedStandards: ['AC9E3LA03'],
    status: 'closed',
    questions: [
      {
        id: 'q1',
        number: 1,
        question_text: 'What is the purpose of the complication in a narrative story?',
        question_type: 'multiple_choice',
        options: ['To introduce a problem for the characters to solve', 'To list ingredients', 'To say goodbye', 'To provide a dictionary definition'],
        correct_answer: 'To introduce a problem for the characters to solve',
        marks: 5,
        explanation: 'A narrative complication introduces the conflict or dilemma.',
        cognitive_verb: 'Analyze'
      }
    ]
  }
];

const INITIAL_STUDENT_SUBMISSIONS: StudentTestSubmission[] = [
  {
    id: 'sub-seed-alex',
    assessmentId: 'test-y3-fractions',
    assessmentTitle: 'Year 3 Mathematics: Fractions & Number Line Mastery',
    studentId: 'std-001',
    studentName: 'Alex Johnson',
    studentEmail: 'student@safescholar.edu.au',
    studentYearLevel: 'Year 3',
    submittedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    earnedMarks: 8,
    totalMarks: 10,
    percentage: 80,
    gradeBand: 'B',
    answers: { 1: '6/8 (or 3/4)', 2: '4 quarters', 3: '2 1/2', 4: '1/4 is greater' },
    timeSpentSeconds: 720
  },
  {
    id: 'sub-seed-mia',
    assessmentId: 'test-y4-science',
    assessmentTitle: 'Year 4 Science: Living & Non-Living Ecosystems Checkpoint',
    studentId: 'std-002',
    studentName: 'Mia Chen',
    studentEmail: 'mia.chen@safescholar.edu.au',
    studentYearLevel: 'Year 4',
    submittedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    earnedMarks: 10,
    totalMarks: 10,
    percentage: 100,
    gradeBand: 'A',
    answers: { 1: 'Growth and response to stimuli', 2: 'Water temperature and sunlight', 3: 'Curved claws and strong limbs for climbing' },
    timeSpentSeconds: 610
  },
  {
    id: 'sub-seed-lucas',
    assessmentId: 'test-y3-fractions',
    assessmentTitle: 'Year 3 Mathematics: Fractions & Number Line Mastery',
    studentId: 'std-003',
    studentName: 'Lucas Miller',
    studentEmail: 'lucas.m@safescholar.edu.au',
    studentYearLevel: 'Year 3',
    submittedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    earnedMarks: 6,
    totalMarks: 10,
    percentage: 60,
    gradeBand: 'C',
    answers: { 1: '6/8 (or 3/4)', 2: '2 quarters', 3: '2 1/2', 4: 'They are equal' },
    timeSpentSeconds: 840
  },
  {
    id: 'sub-seed-chloe',
    assessmentId: 'test-prep-phonics',
    assessmentTitle: 'Prep / Foundation: Letters, Sounds & Sight Words',
    studentId: 'std-004',
    studentName: 'Chloe Taylor',
    studentEmail: 'chloe.t@safescholar.edu.au',
    studentYearLevel: 'Prep',
    submittedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    earnedMarks: 6,
    totalMarks: 6,
    percentage: 100,
    gradeBand: 'A',
    answers: { 1: 'K', 2: 'Hat', 3: 'Yellow' },
    timeSpentSeconds: 320
  }
];

export const assessmentAssignmentService = {
  /**
   * Retrieves all published teacher assessments
   */
  getAssignedAssessments(): AssignedAssessment[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TESTS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback to initial seed
    }
    this.saveAssessments(INITIAL_ASSIGNED_TESTS);
    return INITIAL_ASSIGNED_TESTS;
  },

  /**
   * Saves assessments list to shared storage and triggers window event
   */
  saveAssessments(tests: AssignedAssessment[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_TESTS, JSON.stringify(tests));
      window.dispatchEvent(new Event('safescholar_assigned_tests_updated'));
    } catch (err) {
      console.error('Failed to save assigned assessments:', err);
    }
  },

  /**
   * Publishes a newly generated assessment from a Teacher to the entire class/year level
   */
  publishAssessment(
    generated: AssessmentSchema,
    options: {
      gradeLevel: string;
      subject: string;
      assessmentType: string;
      deadline: string; // ISO string
      teacherName: string;
      teacherEmail: string;
      isImmediateStart?: boolean;
      timeLimitMinutes?: number;
    }
  ): AssignedAssessment {
    const current = this.getAssignedAssessments();
    const normalizedGrade = normalizeYearLevel(options.gradeLevel);
    
    const newAssigned: AssignedAssessment = {
      id: `test-${Date.now()}`,
      title: generated.test_title || `${normalizedGrade} ${options.subject} Assessment`,
      subject: options.subject,
      gradeLevel: normalizedGrade,
      assessmentType: options.assessmentType,
      assignedByTeacherName: options.teacherName || 'Classroom Teacher',
      assignedByTeacherEmail: options.teacherEmail || 'teacher@safescholar.edu.au',
      createdAt: new Date().toISOString(),
      deadline: options.deadline || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      timeLimitMinutes: options.timeLimitMinutes || generated.time_limit_minutes || 20,
      totalMarks: generated.total_marks || (generated.questions?.length ? generated.questions.length * 2 : 20),
      instructions: generated.instructions || `Australian Curriculum ${normalizedGrade} assessment. Please answer all questions before the declared deadline.`,
      alignedStandards: generated.aligned_standards || ['ACARA v9.0'],
      questions: generated.questions || [],
      status: 'active',
      isImmediateStart: options.isImmediateStart || false
    };

    const updated = [newAssigned, ...current];
    this.saveAssessments(updated);
    
    // Also save as latest test for direct jump
    localStorage.setItem('safescholar_latest_assigned_test', JSON.stringify(generated));
    return newAssigned;
  },

  /**
   * Gets assessments filtered strictly by student year level (Prep, Year 1, Year 2, Year 3, Year 4, Year 5)
   */
  getAssessmentsForYear(yearLevel: string): AssignedAssessment[] {
    const normalized = normalizeYearLevel(yearLevel);
    const all = this.getAssignedAssessments();
    return all.filter((t) => normalizeYearLevel(t.gradeLevel) === normalized);
  },

  /**
   * Finds assessment by unique ID
   */
  getAssessmentById(id: string): AssignedAssessment | null {
    const all = this.getAssignedAssessments();
    return all.find((t) => t.id === id) || null;
  },

  /**
   * Submits a completed student test attempt
   */
  submitTest(submission: StudentTestSubmission): void {
    try {
      const subs = this.getAllSubmissions();
      const updated = [submission, ...subs];
      localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(updated));
      window.dispatchEvent(new Event('safescholar_submissions_updated'));
    } catch (err) {
      console.error('Failed to save student test submission:', err);
    }
  },

  /**
   * Gets all recorded student submissions
   */
  getAllSubmissions(): StudentTestSubmission[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    this.saveSubmissions(INITIAL_STUDENT_SUBMISSIONS);
    return INITIAL_STUDENT_SUBMISSIONS;
  },

  saveSubmissions(subs: StudentTestSubmission[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(subs));
    } catch (e) {
      console.warn('Could not save submissions to localStorage', e);
    }
  },

  /**
   * Gets all student submissions for a specific assessment (used by teacher)
   */
  getSubmissionsForAssessment(assessmentId: string): StudentTestSubmission[] {
    const all = this.getAllSubmissions();
    return all.filter((s) => s.assessmentId === assessmentId);
  },

  /**
   * Gets all submissions made by a specific student
   */
  getStudentSubmissions(studentIdentifier: string): StudentTestSubmission[] {
    const all = this.getAllSubmissions();
    if (!studentIdentifier) return all;
    const lower = studentIdentifier.toLowerCase().trim();
    return all.filter((s) => 
      s.studentId.toLowerCase() === lower || 
      s.studentEmail.toLowerCase() === lower || 
      s.studentName.toLowerCase().includes(lower)
    );
  },

  /**
   * Finds latest submission for a specific student and assessment
   */
  getSubmissionForStudentAndTest(studentIdentifier: string, assessmentId: string): StudentTestSubmission | null {
    const all = this.getStudentSubmissions(studentIdentifier);
    return all.find((s) => s.assessmentId === assessmentId) || null;
  },

  /**
   * Gets current student's enrolled year level
   */
  getEnrolledYearLevel(): AustralianYearLevel {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_STUDENT_YEAR);
      if (stored) {
        return normalizeYearLevel(stored);
      }
    } catch {
      // Fallback
    }
    return 'Year 3'; // Standard Australian primary middle-years default
  },

  /**
   * Sets current student's enrolled year level (enables testing across Prep to Year 5)
   */
  setEnrolledYearLevel(year: string): void {
    const normalized = normalizeYearLevel(year);
    localStorage.setItem(STORAGE_KEY_STUDENT_YEAR, normalized);
    window.dispatchEvent(new Event('safescholar_student_year_updated'));
  }
};
