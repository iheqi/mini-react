import * as React from 'react';

// 在 shared 中做一下中转和解耦
// reconcile <==> shared <==> react
const internals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
export default internals;
