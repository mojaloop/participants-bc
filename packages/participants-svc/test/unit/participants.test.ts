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
 *  - Sithu Kyaw <sithu.kyaw@thitsaworks.com>

 --------------
 ******/

"use strict";

import { ApprovalRequestState, IParticipantContactInfoChangeRequest, IParticipantSourceIpChangeRequest, ParticipantAllowedSourceIpsPortModes } from "@mojaloop/participant-bc-public-types-lib";
import { Participant } from "../../src/domain/entities/participant";

describe('Participant Class', () => {

    const now = Date.now();

    const sourceIpChangeRequest : IParticipantSourceIpChangeRequest = {
        id: "",
        cidr: "",
        portMode: ParticipantAllowedSourceIpsPortModes.ANY,
        ports: [],
        portRange: {
            rangeFirst: 0,
            rangeLast: 0
        },
        allowedSourceIpId: null,
        createdBy: "",
        createdDate: NaN,
        requestState: ApprovalRequestState.CREATED,
        rejectedBy:null,
        rejectedDate:null,
        approvedBy: null,
        approvedDate: null,
        requestType: "ADD_SOURCE_IP"
    };

    beforeAll(async () => {
        console.log("Unit tests for participant");
    });

    
    
    describe('ValidateParticipantSourceIpChangeRequest', () => {

        it("Should resolve for valid source IP change request", async () => {
            

            const validRequest: IParticipantSourceIpChangeRequest =
            {   ...sourceIpChangeRequest,
                id: "1",
                cidr: "192.168.1.0/24",
                portMode: ParticipantAllowedSourceIpsPortModes.ANY,
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                requestType: "ADD_SOURCE_IP"
            }

            await expect(Participant.ValidateParticipantSourceIpChangeRequest(validRequest)).resolves.toBeUndefined();

        });

        // Get participant by id (non-existing):
        it("Should reject with an error for empty CIDR", async () => {
            const now = Date.now();

            const invalidRequest: IParticipantSourceIpChangeRequest =
            {   ...sourceIpChangeRequest,
                id: "1",
                cidr: "",
                portMode: ParticipantAllowedSourceIpsPortModes.ANY,
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                requestType: "ADD_SOURCE_IP"
            }

            await expect(Participant.ValidateParticipantSourceIpChangeRequest(invalidRequest))
                .rejects.toThrow('CIDR cannot be empty.');
        });

        it("Should reject with an error for invalid CIDR format", async () => {
            const now = Date.now();

            const invalidRequest: IParticipantSourceIpChangeRequest =
            {
                ...sourceIpChangeRequest,
                id: "1",
                cidr: "192.168.0.20",
                portMode: ParticipantAllowedSourceIpsPortModes.ANY,
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                requestType: "ADD_SOURCE_IP"
            }

            await expect(Participant.ValidateParticipantSourceIpChangeRequest(invalidRequest))
                .rejects.toThrow('Invalid CIDR format.');
        });

        it("Should reject with an error for invalid port range values", async () => {
            const now = Date.now();

            const invalidRequest: IParticipantSourceIpChangeRequest =
            {
                ...sourceIpChangeRequest,
                id: "1",
                cidr: "192.168.0.20/22",
                portMode: ParticipantAllowedSourceIpsPortModes.RANGE,
                ports: [],
                portRange: {
                    rangeFirst: 0,
                    rangeLast: 0
                },
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                requestType: "ADD_SOURCE_IP"
            }

            await expect(Participant.ValidateParticipantSourceIpChangeRequest(invalidRequest))
                .rejects.toThrow('Invalid Port Range values.');
        });

        it("Should reject with an error if rangeFirst is greater than rangeLast", async () => {
            const now = Date.now();

            const invalidRequest: IParticipantSourceIpChangeRequest =
            {
                ...sourceIpChangeRequest,
                id: "1",
                cidr: "192.168.0.20/22",
                portMode: ParticipantAllowedSourceIpsPortModes.RANGE,
                ports: [],
                portRange: {
                    rangeFirst: 3300,
                    rangeLast: 3200
                },
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                requestType: "ADD_SOURCE_IP"
            }

            await expect(Participant.ValidateParticipantSourceIpChangeRequest(invalidRequest))
                .rejects.toThrow('Invalid Port Range values.');
        });

        it("Should reject with an error if spcific ports are invalid", async () => {
            const now = Date.now();

            const invalidRequest: IParticipantSourceIpChangeRequest =
            {
                ...sourceIpChangeRequest,
                id: "1",
                cidr: "192.168.0.20/22",
                portMode: ParticipantAllowedSourceIpsPortModes.SPECIFIC,
                ports: [0, 0],
                portRange: {
                    rangeFirst: 0,
                    rangeLast: 0
                },
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                requestType: "ADD_SOURCE_IP"
            }

            await expect(Participant.ValidateParticipantSourceIpChangeRequest(invalidRequest))
                .rejects.toThrow('Invalid Port value.');

            const invalidRequest1: IParticipantSourceIpChangeRequest =
            {
                id: "1",
                cidr: "192.168.0.20/22",
                portMode: ParticipantAllowedSourceIpsPortModes.SPECIFIC,
                ports: undefined,
                portRange: {
                    rangeFirst: 0,
                    rangeLast: 0
                },
                allowedSourceIpId: null,
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                rejectedBy:null,
                rejectedDate:null,
                approvedBy: null,
                approvedDate: null,
                requestType: "ADD_SOURCE_IP"
            }

            await expect(Participant.ValidateParticipantSourceIpChangeRequest(invalidRequest1))
                .rejects.toThrow('Invalid Port value.');
        });

        it("Should resolve for valid specif port values", async () => {
            const now = Date.now();

            const validSpecificPorts: IParticipantSourceIpChangeRequest =
            {
                id: "1",
                cidr: "192.168.0.20/22",
                portMode: ParticipantAllowedSourceIpsPortModes.SPECIFIC,
                ports: [3010, 4088],
                portRange: {
                    rangeFirst: 0,
                    rangeLast: 0
                },
                allowedSourceIpId: null,
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                rejectedBy:null,
                rejectedDate:null,
                approvedBy: null,
                approvedDate: null,
                requestType: "ADD_SOURCE_IP"
            }

            await expect(Participant.ValidateParticipantSourceIpChangeRequest(validSpecificPorts))
            .resolves.toBeUndefined();

            
        });
    });

    describe("ValidateParticipantContactInfoChangeRequest", () => {
        const now = Date.now();

        it("Should resolve for valid contact info change request", async () => {
            const validRequest: IParticipantContactInfoChangeRequest = {
                id: "1",
                name: "John Doe",
                email: "john.doe@example.com",
                phoneNumber: "123-456-7890",
                role: "portal staff",
                contactInfoId: null,
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                rejectedBy:null,
                rejectedDate:null,
                approvedBy: null,
                approvedDate: null,
                requestType: "ADD_PARTICIPANT_CONTACT_INFO"
            };

            await expect(Participant.ValidateParticipantContactInfoChangeRequest(validRequest))
                .resolves.toBeUndefined();
        });

        it('Should reject with an error for empty name', async () => {
            const invalidRequest: IParticipantContactInfoChangeRequest = {
                id: "1",
                name: "",
                email: "john.doe@example.com",
                phoneNumber: "123-456-7890",
                role: "portal staff",
                contactInfoId: null,
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                rejectedBy:null,
                rejectedDate:null,
                approvedBy: null,
                approvedDate: null,
                requestType: "ADD_PARTICIPANT_CONTACT_INFO"
            };

            await expect(Participant.ValidateParticipantContactInfoChangeRequest(invalidRequest))
                .rejects.toThrow("Contact name cannot be empty.");
        });

        it('Should reject with an error for invalid email', async () => {
            const invalidRequest: IParticipantContactInfoChangeRequest = {
                id: "1",
                name: 'John Doe',
                email: 'invalidemail',
                phoneNumber: '123-456-7890',
                role: "portal staff",
                contactInfoId: null,
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                rejectedBy:null,
                rejectedDate:null,
                approvedBy: null,
                approvedDate: null,
                requestType: "ADD_PARTICIPANT_CONTACT_INFO"
            };

            await expect(Participant.ValidateParticipantContactInfoChangeRequest(invalidRequest))
                .rejects.toThrow("Invalid contact email.");
        });

        it('Should reject with an error for invalid phonenumber', async () => {
            const invalidRequest: IParticipantContactInfoChangeRequest = {
                id: "1",
                name: 'John Doe',
                email: 'john.doe@example.com',
                phoneNumber: '1324aaaa535',
                role: "portal staff",
                contactInfoId: null,
                createdBy: "user",
                createdDate: now,
                requestState: ApprovalRequestState.CREATED,
                rejectedBy:null,
                rejectedDate:null,
                approvedBy: null,
                approvedDate: null,
                requestType: "ADD_PARTICIPANT_CONTACT_INFO"
            };

            await expect(Participant.ValidateParticipantContactInfoChangeRequest(invalidRequest))
                .rejects.toThrow("Invalid contact phone number.");
        });
        

    });


});
