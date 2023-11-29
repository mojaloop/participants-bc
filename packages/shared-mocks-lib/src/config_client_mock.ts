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

 * Arg Software
 - José Antunes <jose.antunes@arg.software>
 - Rui Rocha <rui.rocha@arg.software>

 --------------
 ******/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {ConfigFeatureFlag, ConfigParameter, ConfigSecret, Currency, IBoundedContextConfigurationClient, IConfigurationClient, IGlobalConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";

export class MemoryGlobalConfigClientMock implements IGlobalConfigurationClient {
	getCurrencies(): Currency[] {
		return [{
			code: "USD",
			num: "123",
			decimals: 2
		}];
	}
	schemaVersion: string;
	iterationNumber: number;
	has(name: string): boolean {
		throw new Error("Method not implemented.");
	}
	allKeys(): string[] {
		throw new Error("Method not implemented.");
	}
	getParam(paramName: string): ConfigParameter | null {
		throw new Error("Method not implemented.");
	}
	getAllParams(): ConfigParameter[] {
		throw new Error("Method not implemented.");
	}
	getFeatureFlag(featureFlagName: string): ConfigFeatureFlag | null {
		throw new Error("Method not implemented.");
	}
	getAllFeatureFlags(): ConfigFeatureFlag[] {
		throw new Error("Method not implemented.");
	}
	getSecret(secretName: string): ConfigSecret | null {
		throw new Error("Method not implemented.");
	}
	getAllSecrets(): ConfigSecret[] {
		throw new Error("Method not implemented.");
	}



}


export class MemoryConfigClientMock implements IConfigurationClient {
    private readonly logger: ILogger;
    private readonly authTokenUrl: string;

	initialised: boolean;

	constructor(
		logger: ILogger,
		authTokenUrl: string,
	) {
		this.logger = logger;
		this.authTokenUrl = authTokenUrl;
	}
	get boundedContextName(): string {
		return "exampleBoundedContextName";
	}
	get applicationName(): string {
		return "exampleApplicationName";
	}
	get applicationVersion(): string {
		return "exampleApplicationVersion";
	}
	get bcConfigs(): IBoundedContextConfigurationClient {
		return {} as IBoundedContextConfigurationClient;
	}
	get globalConfigs(): IGlobalConfigurationClient {
		return new MemoryGlobalConfigClientMock();
	}
	init(): Promise<void> {
		return Promise.resolve();
	}
	destroy(): Promise<void> {
		return Promise.resolve();
	}
	fetch(): Promise<void> {
		return Promise.resolve();
	}
	bootstrap(ignoreDuplicateError?: boolean | undefined): Promise<boolean> {
		return Promise.resolve(true);
	}
	setChangeHandlerFunction(fn: (type: "BC" | "GLOBAL") => void): void {
		return;
	}


}
