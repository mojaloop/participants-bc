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
import { CallSecurityContext, ITokenHelper } from "@mojaloop/security-bc-public-types-lib";

export class TokenHelperMock implements ITokenHelper {
	private readonly logger: ILogger;
	
	constructor(
		logger: ILogger,
	) {
		this.logger = logger;
	}
	
	init(): Promise<void> {
		return Promise.resolve();
    }
	
    destroy(): Promise<void> {
		return Promise.resolve();
    }
	
	decodeToken(_accessToken: string) {
		return;
	}

	verifyToken(_accessToken: string): Promise<boolean> {
        return Promise.resolve(true);
	}

	getCallSecurityContextFromAccessToken(accessToken: string): Promise<CallSecurityContext | null> {
		const secCtx: CallSecurityContext = {
			username: "admin",
			clientId: "admin",
			platformRoleIds: ["admin"],
			accessToken: "mock-token",
		};
		
		return Promise.resolve(secCtx);
	}
}