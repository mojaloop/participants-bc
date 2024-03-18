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

 * ThitsaWorks
 - Sithu Kyaw <sithu.kyaw@thitsaworks.com>
 - Zwe Htet Myat <zwehtet.myat@thitsaworks.com>
 --------------
 ******/

"use strict";


import { IParticipantsRepository } from "@mojaloop/participants-bc-participants-svc/src/domain/repo_interfaces";
import { 
    IParticipant
} from "@mojaloop/participant-bc-public-types-lib";
import { ParticipantSearchResults } from "@mojaloop/participants-bc-participants-svc/src/domain/server_types";
import { mockedParticipantHub } from "./mocked_data";


const MAX_ENTRIES_PER_PAGE = 100;


export class ParticipantsRepoMock implements IParticipantsRepository {
    private _participants: IParticipant[] = [];

    constructor() {
        this._participants.push(mockedParticipantHub);
    }

    init(): Promise<void> {
        return Promise.resolve();
    }

    destroy(): Promise<void> {
        return Promise.resolve();
    }

    create(participant: IParticipant): Promise<boolean> {
        this._participants.push(participant);
        return Promise.resolve(true);
    }

    store(participant: IParticipant): Promise<boolean> {
        const found = this._participants.find((partItem) => {
            return partItem.id === participant.id;
        });

        if (found) {
            Object.assign(found, participant);
        } else {
            this._participants.push(participant);
        }

        return Promise.resolve(true);
    }

    fetchAll(): Promise<IParticipant[]> {
        return Promise.resolve(this._participants);
    }

    fetchWhereId(id: string): Promise<IParticipant | null> {
        const found = this._participants.find((partItem) => {
            return partItem.id === id;
        });

        return Promise.resolve(found || null);
    }

    fetchWhereName(participantName: string): Promise<IParticipant | null> {
        const found = this._participants.find((partItem) => {
            return partItem.name === participantName;
        });

        return Promise.resolve(found || null);
    }

    fetchWhereIds(id: string[]): Promise<IParticipant[]> {
        const found = this._participants.filter((partItem) => {
            return id.find((idstr) => idstr === partItem.id) != null;
        });

        return Promise.resolve(found);
    }

    searchParticipants(
        id: string | null, 
        name: string | null, 
        state: string | null, 
        pageIndex = 0,
        pageSize: number = MAX_ENTRIES_PER_PAGE,
    ): Promise<ParticipantSearchResults> {
        pageIndex = Math.max(pageIndex, 0);
		pageSize = Math.min(pageSize, MAX_ENTRIES_PER_PAGE);
		const index = pageIndex * pageSize;
		const total = index + pageSize;

        const returnVal: IParticipant[] = this._participants.filter((partItem) => {
            let idMatch = true;
            if (id) idMatch = (id === partItem.id);

            let nameMatch = true;
            if (name) nameMatch = (name === partItem.name);

            let stateMatch = true;
            if (state) stateMatch = (partItem.approved === (state === "APPROVED"));
            
            return idMatch && nameMatch && stateMatch;
        });

        const searchResults: ParticipantSearchResults = {
			pageIndex: pageIndex,
			pageSize: pageSize,
			totalPages: 0,
			items: []
		};

		if (returnVal.length > 0) {
			const paginatedVal = returnVal.slice(index, total);
			searchResults.items = paginatedVal;
			searchResults.totalPages = Math.ceil(returnVal.length / pageSize);
		}

		return Promise.resolve(searchResults);
    }

    getSearchKeywords(): Promise<{ fieldName: string; distinctTerms: string[]; }[]> {
        const result:{ fieldName: string; distinctTerms: string[]; }[]= [
            {
                fieldName: "payerIdType",
                distinctTerms: ["MSISDN","ACCOUNTID"]
            },
            {
                fieldName: "payeeIdType",
                distinctTerms: ["MSISDN","ACCOUNTID"]
            }
        ];

        return Promise.resolve(result);
    }
}