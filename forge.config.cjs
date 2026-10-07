const path = require('node:path');
const { version } = require('./package.json');
const included = new Set(['app-dist', 'desktop-dist', 'package.json', 'THIRD_PARTY_NOTICES.md']);

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'antwork',
    icon: path.join(__dirname, 'desktop', 'assets', 'icon.ico'),
    prune: false,
    ignore: file => Boolean(file) && !included.has(file.replaceAll('\\', '/').split('/').filter(Boolean)[0]),
    win32metadata: { CompanyName: 'antwork', ProductName: 'antwork', FileDescription: 'Local-first work timer and private work history' },
  },
  makers: [{
    name: '@electron-forge/maker-squirrel',
    config: { name: 'antwork', authors: 'antwork', description: 'Local-first work timer and private work history', setupExe: `antwork-${version}-Setup.exe`, setupIcon: path.join(__dirname, 'desktop', 'assets', 'icon.ico'), noMsi: true },
  }],
};
