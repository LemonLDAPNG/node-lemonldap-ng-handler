import config from '../../rollup.template.js';

export default config( ['@LLNG/conf', '@LLNG/session', '@LLNG/safelib', 'vm', 're2', 'normalize-url', 'url'] );
