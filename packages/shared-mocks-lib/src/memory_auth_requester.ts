/*****
License
--------------
Copyright © 2020-2025 Mojaloop Foundation
The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

Contributors
--------------
This is the official list of the Mojaloop project contributors for this file.
Names of the original copyright holders (individuals or organizations)
should be listed with a '*' in the first column. People who have
contributed from an organization can be listed under the organization
that actually holds the copyright for their contributions (see the
Mojaloop Foundation for an example). Those individuals should have
their names indented and be marked with a '-'. Email address can be added
optionally within square brackets <email>.

* Mojaloop Foundation
- Name Surname <name.surname@mojaloop.io>

* ThitsaWorks
- Sithu Kyaw <sithu.kyaw@thitsaworks.com>
- Zwe Htet Myat <zwehtet.myat@thitsaworks.com>
*****/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IAuthenticatedHttpRequester} from "@mojaloop/security-bc-public-types-lib";

export class MemoryAuthenticatedHttpRequesterMock implements IAuthenticatedHttpRequester {
    private readonly logger: ILogger;
    private readonly authTokenUrl: string;

    private client_id: string | null = null;
    private client_secret: string | null = null;
    private username: string | null = null;
    private password: string | null = null;

    constructor(
        logger: ILogger,
        authTokenUrl: string,
    ) {
        this.logger = logger;
        this.authTokenUrl = authTokenUrl;
    }

    initialised: boolean;

    setUserCredentials(client_id: string, username: string, password: string): void {
        this.client_id = client_id;
        this.username = username;
        this.password = password;
    }

    setAppCredentials(client_id: string, client_secret: string): void {
        this.client_id = client_id;
        this.client_secret = client_secret;
    }

    async fetch(_requestInfo: RequestInfo, _timeoutMs?: number | undefined): Promise<Response> {
        return await fetch(_requestInfo)
            .then((response) => {
                return response;
            })
            .catch((error) => {
                throw error;
            });
    }

}
