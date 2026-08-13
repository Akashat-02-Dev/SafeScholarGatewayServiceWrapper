import os
import re

ui_dir = "d:/Project/SafeScholarGatewayWrapper/SafeScholarGatewayServiceWrapper/ui"

fixes = [
    # file, regex_find, replace
    ("src/components/AudioSocraticRecorder.tsx", r"import React, ", "import "),
    ("src/components/AudioSocraticRecorder.tsx", r"tokens", "token"),
    ("src/components/CitationRenderer.tsx", r"import React from 'react'", ""),
    ("src/pages/admin/InstitutionAdminDashboard.tsx", r"import \{.*?Trash2.*?\} from 'lucide-react'", lambda m: m.group(0).replace("Trash2, ", "").replace(", Trash2", "")),
    ("src/pages/admin/InstitutionAdminDashboard.tsx", r"const \{.*?, isLoading.*?\} = useAuth\(\)", lambda m: m.group(0).replace("isLoading, ", "").replace(", isLoading", "")),
    ("src/pages/educator/LessonPlannerPage.tsx", r"\{instructional_phases\.map\(\(phase, idx\) => \(", "{instructional_phases.map((phase) => ("),
    ("src/pages/educator/StudentOversightDashboard.tsx", r"booleanean", "boolean"),
    ("src/pages/educator/StudentOversightDashboard.tsx", r"import \{ useState, useEffect \} from 'react'", "import { useState, useEffect, useRef } from 'react'"),
    ("src/pages/educator/StudentOversightDashboard.tsx", r"onChange=\{\(event\) =>", "onChange={() =>"),
    ("src/pages/student/WritingStudio.tsx", r"import \{ useState, useEffect, useRef \} from 'react'", "import { useState } from 'react'"),
    ("src/pages/superadmin/SuperAdminDashboard.tsx", r"import \{.*?Users, AlertCircle.*?\} from 'lucide-react'", lambda m: m.group(0).replace("Users, AlertCircle, ", "").replace(", Users, AlertCircle", "").replace("Users, ", "").replace("AlertCircle, ", "")),
    ("src/pages/superadmin/SuperAdminDashboard.tsx", r"const \{.*?, isLoading.*?\} = useAuth\(\)", lambda m: m.group(0).replace("isLoading, ", "").replace(", isLoading", "")),
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
