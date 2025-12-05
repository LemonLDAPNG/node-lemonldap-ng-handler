import config from "../../rollup.template.mjs";

export default config(["pg", "perl-dbi", "@lemonldap-ng/message-broker"]);
