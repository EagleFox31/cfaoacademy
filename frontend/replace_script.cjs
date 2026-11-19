const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

const iconMapping = {
  't.eyebrow_skills': 'award',
  't.eyebrow_dps_scope': 'building',
  't.eyebrow_next_actions': 'listtodo',
  't.dps_eyebrow_filiale_plans': 'milestone',
  't.eyebrow_dps_filters': 'sliders',
  't.dps_assistance_eyebrow': 'lifebuoy',
  't.eyebrow_field': 'users',
  't.eyebrow_plan': 'milestone',
  'eyebrowOverride ?? t.eyebrow_individual': 'users',
  't.eyebrow_audit': 'clipboard'
};

files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  if (content.includes('portal-section-eyebrow')) {
    let modified = false;
    for (const [key, icon] of Object.entries(iconMapping)) {
      const targetStr = '<p className="portal-section-eyebrow">{' + key + '}</p>';
      const replacementStr = '<PortalSectionEyebrow icon="' + icon + '" label={' + key + '} />';
      if (content.includes(targetStr)) {
        content = content.replaceAll(targetStr, replacementStr);
        modified = true;
      }
    }
    if (modified) {
      if (!content.includes('import PortalSectionEyebrow')) {
         content = 'import PortalSectionEyebrow from \'./PortalSectionEyebrow.jsx\'\n' + content;
      }
      fs.writeFileSync(p, content);
      console.log('Modified', f);
    }
  }
});
