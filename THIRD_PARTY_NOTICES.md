# Third-party notices

The following third-party source files are included and adapted in antwork. This notice covers those components only; it is not a license for antwork as a whole.

- EvilCharts ECharts line chart and supporting UI files in `src/components/evilcharts/`: Copyright (c) 2026 Gurbinder. [Upstream license](https://github.com/legions-developer/evilcharts/blob/main/LICENSE).
- Bencho liquid theme toggle in `src/components/ui/liquid-theme-toggle.tsx`: Copyright (c) 2026 Lorenzo Cabra. [Upstream license](https://bencho.dev/licence). Adapted from the supplied Code-pane component without the demo wrapper.

Each component above is subject to the MIT License:

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The bundled Rubik font has its own [SIL Open Font License](public/fonts/LICENSE.txt). Apache ECharts is installed from npm under [Apache-2.0](https://github.com/apache/echarts/blob/master/LICENSE).

## Windows desktop runtime

Electron is distributed under the MIT License, Copyright (c) Electron contributors and Copyright (c) 2013-2020 GitHub Inc. Its `LICENSE` and `LICENSES.chromium.html` are retained alongside the packaged executable.

The main-process bundle includes `electron-squirrel-startup` 1.0.1 (Apache-2.0) and its dependencies `debug` 2.6.9 (MIT, Copyright (c) 2014 TJ Holowaychuk) and `ms` 2.0.0 (MIT, Copyright (c) 2016 Zeit, Inc.). Their complete license texts are included in `desktop-dist/licenses/` inside the application package.

The installer and update/uninstall helper use Squirrel.Windows under the MIT License, Copyright (c) 2012 GitHub, Inc. The [upstream license](https://github.com/Squirrel/Squirrel.Windows/blob/develop/COPYING) is preserved in `desktop/assets/Squirrel-COPYING.txt` and bundled as `desktop-dist/licenses/Squirrel.Windows.txt`.
