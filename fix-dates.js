const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{ts,tsx}');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  if (content.includes('new Date().toISOString().split("T")[0]')) {
    content = content.replace(/new Date\(\)\.toISOString\(\)\.split\("T"\)\[0\]/g, 'getManilaToday()');
    
    if (content !== original) {
      if (!content.includes('getManilaToday')) {
        if (content.includes('@/lib/utils/finance')) {
          content = content.replace(/import \{([^}]+)\} from "@\/lib\/utils\/finance"/, 'import { getManilaToday, $1 } from "@/lib/utils/finance"');
        } else {
          content = 'import { getManilaToday } from "@/lib/utils/finance";\n' + content;
        }
      } else {
        if (content.includes('@/lib/utils/finance') && !content.match(/getManilaToday/)) {
            content = content.replace(/import \{([^}]+)\} from "@\/lib\/utils\/finance"/, 'import { getManilaToday, $1 } from "@/lib/utils/finance"');
        }
      }
      fs.writeFileSync(file, content);
      console.log(`Updated ${file}`);
    }
  }
});
