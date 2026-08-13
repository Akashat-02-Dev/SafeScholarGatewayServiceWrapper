import os
import re

ui_dir = "d:/Project/SafeScholarGatewayWrapper/SafeScholarGatewayServiceWrapper/ui"

fixes = [
    # file, regex_find, replace
    ("src/components/AudioSocraticRecorder.tsx", r"import React, { useState, useRef, useEffect } from 'react'", "import { useState, useRef, useEffect } from 'react'"),
    ("src/components/AudioSocraticRecorder.tsx", r"import \{ apiFetch \} from '\.\./services/apiClient'", ""),
    ("src/components/AudioSocraticRecorder.tsx", r"const token = ", "// const token = "),
    ("src/components/CitationRenderer.tsx", r"import React from 'react'", ""),
    ("src/pages/admin/InstitutionAdminDashboard.tsx", r"import \{.*?Trash2.*?\} from 'lucide-react'", lambda m: m.group(0).replace("Trash2, ", "").replace(", Trash2", "")),
    ("src/pages/admin/InstitutionAdminDashboard.tsx", r"const \{.*?, isLoading.*?\} = useAuth\(\)", lambda m: m.group(0).replace("isLoading, ", "").replace(", isLoading", "")),
    ("src/pages/ai/IepGenerator.tsx", r"import \{.*?Table.*?\} from 'lucide-react'", lambda m: m.group(0).replace("Table, ", "").replace(", Table", "")),
    ("src/pages/ai/LessonPlanner.tsx", r"import \{.*?Send, GraduationCap.*?\} from 'lucide-react'", lambda m: m.group(0).replace("Send, GraduationCap, ", "").replace(", Send, GraduationCap", "").replace("Send, ", "").replace("GraduationCap, ", "")),
    ("src/pages/educator/LessonPlannerPage.tsx", r"\{instructional_phases\.map\(\(phase, idx\) => \(", "{instructional_phases.map((phase) => ("),
    ("src/pages/educator/StudentOversightDashboard.tsx", r"import React.*?from 'react'", "import { useState, useEffect } from 'react'"),
    ("src/pages/educator/StudentOversightDashboard.tsx", r"bool", "boolean"),
    ("src/pages/educator/StudentOversightDashboard.tsx", r"onChange=\{\(event\) =>", "onChange={() =>"),
    ("src/pages/educator/TextLevelerPage.tsx", r"itemsAlign: 'center'", "alignItems: 'center'"),
    ("src/pages/student/StudentChatHub.tsx", r"import \{.*?Library.*?\} from 'lucide-react'", lambda m: m.group(0).replace("Library, ", "").replace(", Library", "")),
    ("src/pages/student/StudentChatHub.tsx", r"import \{ ConnectionState \} from '\.\./\.\./services/WSTutorService'", "import type { ConnectionState } from '../../services/WSTutorService'"),
    ("src/pages/student/WritingStudio.tsx", r"import React.*?from 'react'", "import { useState, useEffect, useRef } from 'react'"),
    ("src/pages/superadmin/SuperAdminDashboard.tsx", r"import \{.*?Users, AlertCircle.*?\} from 'lucide-react'", lambda m: m.group(0).replace("Users, AlertCircle, ", "").replace(", Users, AlertCircle", "").replace("Users, ", "").replace("AlertCircle, ", "")),
    ("src/pages/superadmin/SuperAdminDashboard.tsx", r"const \{.*?, isLoading.*?\} = useAuth\(\)", lambda m: m.group(0).replace("isLoading, ", "").replace(", isLoading", "")),
    ("src/pages/UserManagement.tsx", r"import \{.*?handleConfirmDelete.*?\}", ""), # already fixed but just in case
    ("src/services/wsTutorService.ts", r"\(state\)", "()"),
]

for file_rel, pattern, repl in fixes:
    path = os.path.join(ui_dir, file_rel)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        
        if callable(repl):
            new_content = re.sub(pattern, repl, content)
        else:
            new_content = re.sub(pattern, repl, content)
            
        if new_content != content:
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Fixed {file_rel}")
        else:
            print(f"Pattern not found or unchanged for {file_rel}")
    else:
        print(f"File not found: {file_rel}")
