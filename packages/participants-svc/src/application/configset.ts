/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Coil
 - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import { ConfigurationClient,IConfigProvider } from "@mojaloop/platform-configuration-bc-client-lib";
import {ConfigParameterTypes} from "@mojaloop/platform-configuration-bc-public-types-lib";

// configs - constants / code dependent
const CONFIGSET_VERSION = "0.3.8";

export function GetParticipantsConfigs(
    bcName:string,
    configProvider?: IConfigProvider,
): ConfigurationClient {
    const configClient = new ConfigurationClient(
        bcName, CONFIGSET_VERSION, configProvider
    );

    /*
    * Add application parameters here
    * */
    configClient.bcConfigs.addNewParam(
        "MAKER_CHECKER_ENABLED",
        ConfigParameterTypes.BOOL,
        true,
        "Enable maker-checker enforcement in participants"
    );

// configClient.appConfigs.addNewParam(
//         "MAX_VALUE_PER_DEPOSIT",
//         ConfigParameterTypes.BOOL,
//         true,
//         "Enable maker-checker enforcement in participants"
// );

    return configClient;
}
