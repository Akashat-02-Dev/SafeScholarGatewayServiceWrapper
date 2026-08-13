import os
import re

ui_dir = "d:/Project/SafeScholarGatewayWrapper/SafeScholarGatewayServiceWrapper/ui"

fixes = [
    ("src/components/AudioSocraticRecorder.tsx", r"const token =.*?;\n", ""),
    ("src/components/CitationRenderer.tsx", r"import React from 'react';?\n", ""),
    ("src/pages/admin/InstitutionAdminDashboard.tsx", r"import \{ Trash2 \} from 'lucide-react';?\n", ""),
    ("src/pages/admin/InstitutionAdminDashboard.tsx", r"const \{ isLoading \} = useAuth\(\)", "const {} = useAuth()"), # or just remove the line if possible, but let's just do `const {} = useAuth()`
    ("src/pages/educator/LessonPlannerPage.tsx", r"idx\)", ")"),
    ("src/pages/educator/StudentOversightDashboard.tsx", r"event", ""),
    ("src/pages/superadmin/SuperAdminDashboard.tsx", r"import \{ Users, AlertCircle \} from 'lucide-react';?\n", ""),
    ("src/pages/superadmin/SuperAdminDashboard.tsx", r"const \{ isLoading \} = useAuth\(\)", "const {} = useAuth()"),
    ("src/services/wsTutorService.ts", r"\(state\)", "()"),
]

for file_rel, pattern, repl in fixes:
    path = os.path.join(ui_dir, file_rel)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        
        new_content = re.sub(pattern, repl, content)
            
        if new_content != content:
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_content)
