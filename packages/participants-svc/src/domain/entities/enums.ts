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

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 --------------
 ******/

"use strict";


//NOTE: reflect any changes to this enum in public-types-lib IParticipant
export enum ParticipantTypes{
	"HUB"= "HUB",
	"DFSP" = "DFSP"
}

//NOTE: reflect any changes to this enum in public-types-lib IParticipantFundsMovement
export enum ParticipantFundsMovementDirections {
	"FUNDS_DEPOSIT"= "FUNDS_DEPOSIT",
	"FUNDS_WITHDRAWAL" = "FUNDS_WITHDRAWAL"
}


//NOTE: reflect any changes to this enum in public-types-lib IParticipantAllowedSourceIps
export enum ParticipantAllowedSourceIpsPortModes {
	"ANY"="ANY",
	"SPECIFIC"="SPECIFIC",
	"RANGE"="RANGE",
}

//NOTE: reflect any changes to this enum in public-types-lib IParticipantEndpoint
export enum ParticipantEndpointTypes{
	"FSPIOP"= "FSPIOP",
	"ISO20022" = "ISO20022"
}

//NOTE: reflect any changes to this enum in public-types-lib IParticipantEndpoint
export enum ParticipantEndpointProtocols{
	"HTTPs/REST"= "HTTPs/REST"
}

//NOTE: reflect any changes to this enum in public-types-lib IParticipantAccount
export enum ParticipantAccountTypes {
	"FEE" = "FEE",
	"POSITION" = "POSITION",
	"SETTLEMENT" = "SETTLEMENT",
	"HUB_MULTILATERAL_SETTLEMENT" = "HUB_MULTILATERAL_SETTLEMENT",
	"HUB_RECONCILIATION" = "HUB_RECONCILIATION"
}

//NOTE: reflect any changes to this enum in public-types-lib IParticipantNetDebitCapTypes
export enum ParticipantNetDebitCapTypes {
	"ABSOLUTE" = "ABSOLUTE",
	"PERCENTAGE" = "PERCENTAGE"
}

//NOTE: reflect any changes to this enum in public-types-lib IParticipantActivityLogEntry
export enum ParticipantChangeTypes {
	"CREATE"= "CREATE",
	"APPROVE"= "APPROVE",
	"ACTIVATE"= "ACTIVATE",
	"DEACTIVATE"= "DEACTIVATE",
	"CHANGE_ACCOUNT"= "CHANGE_ACCOUNT",
	"REMOVE_ACCOUNT"= "REMOVE_ACCOUNT",
	"ADD_ENDPOINT"= "ADD_ENDPOINT",
	"REMOVE_ENDPOINT"= "REMOVE_ENDPOINT",
	"CHANGE_ENDPOINT"= "CHANGE_ENDPOINT",
	"ADD_SOURCEIP"= "ADD_SOURCEIP",
	"REMOVE_SOURCEIP"= "REMOVE_SOURCEIP",
	"CHANGE_SOURCEIP"= "CHANGE_SOURCEIP",
	"FUNDS_DEPOSIT"= "FUNDS_DEPOSIT",
	"FUNDS_WITHDRAWAL"= "FUNDS_WITHDRAWAL",
	"NDC_CHANGE"="NDC_CHANGE",
	"NDC_RECALCULATED"="NDC_RECALCULATED"
}

