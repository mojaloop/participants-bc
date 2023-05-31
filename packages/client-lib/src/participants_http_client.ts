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

 * Coil
 - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
    IParticipant,
    IParticipantAccount,
    IParticipantEndpoint,
} from "@mojaloop/participant-bc-public-types-lib";
import {
    UnableToCreateParticipantError,
    UnableToGetParticipantsError,
} from "./errors";
import {IAuthenticatedHttpRequester} from "@mojaloop/security-bc-client-lib";

const DEFAULT_TIMEOUT_MS = 5000;

export class ParticipantsHttpClient {
    // Properties received through the constructor.
    private readonly _logger: ILogger;
    // Other properties.
    private readonly _baseUrlHttpService: string;
    private readonly _authRequester: IAuthenticatedHttpRequester;
    private readonly UNKNOWN_ERROR_MESSAGE: string = "Unknown error";
    private accessToken: string;

    constructor(
        logger: ILogger,
        baseUrlHttpService: string,
        authRequester: IAuthenticatedHttpRequester,
        timeoutMs: number = DEFAULT_TIMEOUT_MS
    ) {
        this._logger = logger;
        this._baseUrlHttpService = baseUrlHttpService;
        this._authRequester = authRequester;
    }

    async createParticipant(participant: IParticipant): Promise<{ id: string }> {
        try {
            const url = new URL("/participants", this._baseUrlHttpService).toString();
            const request = new Request(url, {
                method: "POST",
                body: JSON.stringify(participant),
            });

            const resp = await this._authRequester.fetch(request);

            if (resp.status != 200) {
                throw new UnableToCreateParticipantError();
            }

            const data = await resp.json();
            return data;
        } catch (e: unknown) {
            if (e instanceof Error) throw e;
            // handle everything else
            throw new UnableToCreateParticipantError();
        }
    }

    async getAllParticipants(): Promise<IParticipant[]> {
        try {
            const url = new URL("/participants", this._baseUrlHttpService).toString();
            const resp = await this._authRequester.fetch(url);

            if (resp.status != 200 && resp.status != 404) {
                throw new UnableToGetParticipantsError();
            }

            if (resp.status == 404) {
                return [];
            }

            const data = await resp.json();
            return data;
        } catch (e: unknown) {
            if (e instanceof Error) throw e;
            // handle everything else
            throw new UnableToGetParticipantsError();
        }
    }

    async getParticipantsByIds(ids: string[]): Promise<IParticipant[]> {
        try {
            const url = new URL(
                `/participants/${ids.join(",")}/multi`,
                this._baseUrlHttpService
            ).toString();
            const resp = await this._authRequester.fetch(url);

            if (resp.status != 200 && resp.status != 404) {
                throw new UnableToGetParticipantsError();
            }

            if (resp.status == 404) {
                return [];
            }

            const data = await resp.json();
            return data;
        } catch (e: unknown) {
            if (e instanceof Error) throw e;
            // handle everything else
            throw new UnableToGetParticipantsError();
        }
    }

    async getParticipantById(participantId: string): Promise<IParticipant | null> {
        try {
            const url = new URL(
                `/participants/${participantId}`,
                this._baseUrlHttpService
            ).toString();
            const resp = await this._authRequester.fetch(url);

            if (resp.status != 200 && resp.status != 404) {
                throw new UnableToGetParticipantsError();
            }

            if (resp.status == 404) {
                return null;
            }

            const data = await resp.json();
            return data;
        } catch (e: unknown) {
            if (e instanceof Error) throw e;
            // handle everything else
            throw new UnableToGetParticipantsError();
        }
    }

    async getParticipantEndpointsById(participantId: string): Promise<IParticipantEndpoint[] | null> {
        try {
            const url = new URL(
                `/participants/${participantId}/endpoints`,
                this._baseUrlHttpService
            ).toString();
            const resp = await this._authRequester.fetch(url);

            if (resp.status != 200 && resp.status != 404) {
                throw new UnableToGetParticipantsError();
            }

            if (resp.status == 404) {
                return [];
            }

            const data = await resp.json();
            return data;
        } catch (e: unknown) {
            if (e instanceof Error) throw e;
            // handle everything else
            throw new UnableToGetParticipantsError();
        }
    }

    async getParticipantAccountsById(participantId: string): Promise<IParticipantAccount[] | null> {
        try {
            const url = new URL(
                `/participants/${participantId}/accounts`,
                this._baseUrlHttpService
            ).toString();
            const resp = await this._authRequester.fetch(url);

            if (resp.status != 200 && resp.status != 404) {
                throw new UnableToGetParticipantsError();
            }

            if (resp.status == 404) {
                return [];
            }

            const data = await resp.json();
            return data;
        } catch (e: unknown) {
            if (e instanceof Error) throw e;
            // handle everything else
            throw new UnableToGetParticipantsError();
        }
    }

    async searchParticipants(id: string, name: string, state: string): Promise<IParticipant[]> {
        try {
            const url = new URL(
                `/participants?id=${id}&name=${name}&state=${state}`,
                this._baseUrlHttpService
            ).toString();
            const resp = await this._authRequester.fetch(url);

            if (resp.status != 200 && resp.status != 404) {
                throw new UnableToGetParticipantsError();
            }

            if (resp.status == 404) {
                return [];
            }

            const data = await resp.json();
            return data;
        } catch (e: unknown) {
            if (e instanceof Error) throw e;
            // handle everything else
            throw new UnableToGetParticipantsError();
        }
    }
}
