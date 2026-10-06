const path = require('node:path');

module.exports = {
  appId: 'com.squirrel.antwork.antwork',
  productName: 'antwork',
  asar: true,
  npmRebuild: false,
  directories: { app: path.join(__dirname, 'app'), output: path.join(__dirname, 'out') },
  files: [
    'dist/**/*',
    'desktop-dist/**/*',
    'package.json',
    'THIRD_PARTY_NOTICES.md',
    '!node_modules/**/*',
  ],
  win: {
    target: ['nsis'],
    icon: path.join(__dirname, '..', '..', 'desktop', 'assets', 'icon.ico'),
    executableName: 'antwork',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    selectPerMachineByDefault: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    artifactName: 'antwork-${version}-Setup.exe',
  },
};
