const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{ts,tsx}');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('getManilaToday') && !content.includes('function getManilaToday')) {
    if (!content.includes('import ') || (!content.match(/import .*getManilaToday.* from/))) {
      // It's missing the import.
      // If there's already an import from finance, merge it.
      if (content.match(/import \{[^}]*\} from "@\/lib\/utils\/finance"/)) {
        content = content.replace(/import \{([^}]+)\} from "@\/lib\/utils\/finance"/, 'import { getManilaToday, $1 } from "@/lib/utils/finance"');
      } else {
        // Find first import and insert before it
        const firstImportIdx = content.indexOf('import ');
        if (firstImportIdx !== -1) {
          content = content.slice(0, firstImportIdx) + 'import { getManilaToday } from "@/lib/utils/finance";\n' + content.slice(firstImportIdx);
        } else {
          content = 'import { getManilaToday } from "@/lib/utils/finance";\n\n' + content;
        }
      }
      fs.writeFileSync(file, content);
      console.log(`Added import to ${file}`);
    }
  }
});
