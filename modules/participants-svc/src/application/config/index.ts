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

import {
    AppConfiguration,
    DefaultConfigProvider
} from "@mojaloop/platform-configuration-bc-client-lib";
import { ConfigParameterTypes } from "@mojaloop/platform-configuration-bc-types-lib";

// configs - constants / code dependent
const BC_NAME = "typescript-bc-template";
const APP_NAME = "example-svc";
const CONFIGSET_VERSION = "0.0.1";

// configs - non-constants
const ENV_NAME = process.env["ENV_NAME"] || "dev";
const CONFIG_SVC_BASEURL = process.env["CONFIG_SVC_BASEURL"] || "http://localhost:3100";

const defaultConfigProvider: DefaultConfigProvider = new DefaultConfigProvider(CONFIG_SVC_BASEURL);

const appConfig = new AppConfiguration(ENV_NAME, BC_NAME, APP_NAME, CONFIGSET_VERSION, defaultConfigProvider);

/*
* Add application parameters here
* */
appConfig.addNewParam(
        "service-http-port",
        ConfigParameterTypes.INT_NUMBER,
        3000,
        "Http port where the webservice will listen in - v"+CONFIGSET_VERSION
);

export = appConfig;

