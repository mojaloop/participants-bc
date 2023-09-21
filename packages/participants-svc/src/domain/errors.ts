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

export class ParticipantNotFoundError extends Error {}
export class ParticipantCreateValidationError extends Error {}
export class InvalidParticipantError extends Error {}

export class CannotAddDuplicateEndpointError extends Error {}
export class EndpointNotFoundError extends Error {}


export class CannotAddDuplicateAccountError extends Error {}
export class AccountNotFoundError extends Error {}
export class AccountChangeRequestNotFound extends Error {}
export class AccountChangeRequestAlreadyApproved extends Error {}
export class InvalidAccountError extends Error {}

export class CannotAddDuplicateSourceIpError extends Error {}
export class SourceIpNotFoundError extends Error {}
export class SourceIpChangeRequestNotFound extends Error {}
export class SourceIpChangeRequestAlreadyApproved extends Error {}
export class InvalidInvalidError extends Error {}

// export class EndpointTypeExistsError extends Error {}
// export class AccountTypeExistsError extends Error {}

export class NoAccountsError extends Error {}
export class NoEndpointsError extends Error {}
export class UnableToCreateAccountUpstream extends Error {}
export class ParticipantNotActive extends Error {}
export class CouldNotStoreParticipant extends Error {}

export class ParticipantAlreadyApproved extends Error {}

export class NdcChangeRequestNotFound extends Error {}
export class NdcChangeRequestAlreadyApproved extends Error {}
export class InvalidNdcChangeRequest extends Error {}
