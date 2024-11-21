//import { ForbiddenError } from "some-error-library"; // Replace with actual import
import { ConsoleLogger, ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { ParticipantAggregate } from "../../src/domain/participant_agg"; // Replace with actual service path
import {
    CallSecurityContext,
    ForbiddenError,
} from "@mojaloop/security-bc-public-types-lib";
import { AccountsBalancesAdapterMock, AuditClientMock, AuthorizationClientMock, MemoryConfigClientMock, MemoryMessageProducer, mockedParticipant1, mockedParticipant2, mockedParticipantHub, TokenHelperMock } from "@mojaloop/participants-bc-shared-mocks-lib";
import { MetricsMock } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { ApprovalRequestState, IParticipantAccountChangeRequest, IParticipantLiquidityBalanceAdjustment, IParticipantNetDebitCap, IParticipantStatusChangeRequest, ParticipantAccountTypes, ParticipantAllowedSourceIpsPortModes, ParticipantChangeTypes, ParticipantFundsMovementTypes, ParticipantNetDebitCapTypes } from "@mojaloop/participant-bc-public-types-lib";
import { AccountsAndBalancesAccount } from "@mojaloop/accounts-and-balances-bc-public-types-lib";
import { SettlementMatrixSettledEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { MessageTypes } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { mock } from "node:test";

const authTokenUrl = "mocked_auth_url";
const hasPrivilege = true;
const secCtx: CallSecurityContext = {
    username: 'testUser',
    clientId: 'testClient',
    platformRoleIds: ['role1', 'role2'],
    accessToken: 'mockToken',
};

describe("Participants Aggregate", () => {
    let participantAgg: ParticipantAggregate;

    const logger: ILogger = new ConsoleLogger();
    const configClientMock = new MemoryConfigClientMock(logger, authTokenUrl);
    const accAndBalAdapterMock = new AccountsBalancesAdapterMock();
    const auditClientMock = new AuditClientMock(logger);
    const msgProducerMock = new MemoryMessageProducer(logger);
    const metricsMock = new MetricsMock();

    const mockAuthorizationClient = {
        rolesHavePrivilege: jest.fn(),
    };

    const mockRepo = {
        fetchAll: jest.fn(),
        fetchWhereIds: jest.fn(),
        fetchWhereId: jest.fn(),
        store: jest.fn()
    };

    const mockRequestsHisto = {
        startTimer: jest.fn(),
    };

    beforeEach(() => {
        // Initialize service with mocked dependencies

        participantAgg = new ParticipantAggregate(
            configClientMock,
            mockRepo as any,
            accAndBalAdapterMock,
            auditClientMock,
            mockAuthorizationClient as any,
            msgProducerMock,
            metricsMock,
            logger,
        );

        jest.clearAllMocks();
    });

    /**
     * validateAndProcessLiquidityAdjustments()
     * */
    it("should fetch all participants when the user has the required privilege", async () => {

        // Arrange
        const mockSecCtx: CallSecurityContext = {
            username: "testUser",
            clientId: "testClient",
            platformRoleIds: ["role1", "role2"],
            accessToken: "mockToken",
        };

        mockAuthorizationClient.rolesHavePrivilege.mockReturnValue(true);
        const mockParticipants = [mockedParticipant1, mockedParticipant2];

        mockRepo.fetchAll.mockResolvedValue(mockParticipants);

        // Act
        const result = await participantAgg.getAllParticipants(mockSecCtx);

        // Assert
        expect(mockAuthorizationClient.rolesHavePrivilege).toHaveBeenCalledWith(
            mockSecCtx.platformRoleIds,
            "VIEW_PARTICIPANT"
        );

        expect(mockRepo.fetchAll).toHaveBeenCalled();

        expect(result).toEqual(mockParticipants);
    });

    it("should throw ForbiddenError when the user lacks the required privilege", async () => {
        //Arrange

        const mockSecCtx: CallSecurityContext = {
            username: "testUser",
            clientId: "testClient",
            platformRoleIds: ["role1", "role2"],
            accessToken: "mockToken",
        };

        //Act
        mockAuthorizationClient.rolesHavePrivilege.mockReturnValue(false);

        const mockParticipants = [mockedParticipant1, mockedParticipant2];
        mockRepo.fetchAll.mockResolvedValue(mockParticipants);

        //Assert
        await expect(participantAgg.getAllParticipants(mockSecCtx)).rejects.toThrow(
            ForbiddenError
        );

        // Ensure fetchAll was not called
        expect(mockRepo.fetchAll).not.toHaveBeenCalled();
    });


    it('should validate and process adjustments correctly for valid data', async () => {
        //Arrange

        const mockAdjustments: IParticipantLiquidityBalanceAdjustment[] = [
            {
                matrixId: "MATRIX001",
                isDuplicate: true, // Marked as duplicate for testing
                participantId: mockedParticipant1.id,
                participantName: mockedParticipant1.name,
                participantBankAccountInfo: "Bank Account 789",
                bankBalance: "2500.00",
                settledTransferAmount: "2500.00",
                currencyCode: "USD",
                type: ParticipantFundsMovementTypes.OPERATOR_LIQUIDITY_ADJUSTMENT_DEBIT,
                updateAmount: "0", // No adjustment needed as balances match
                settlementAccountId: "SA123"
            }
        ];

        const mockAccounts: AccountsAndBalancesAccount[] = [
            {
                id: "2",
                ownerId: "participant1",
                state: "ACTIVE",
                type: "SETTLEMENT",
                currencyCode: "USD",
                postedDebitBalance: null,
                pendingDebitBalance: null,
                postedCreditBalance: null,
                pendingCreditBalance: null,
                balance: "0",
                timestampLastJournalEntry: 1697835600,

            }
        ];

        await accAndBalAdapterMock.init();

        // Act
        mockAuthorizationClient.rolesHavePrivilege.mockReturnValue(true);
        mockRepo.fetchWhereIds.mockResolvedValue([mockedParticipant1]);

        const accBalSpy = jest.spyOn(accAndBalAdapterMock, "getAccounts").mockResolvedValueOnce(mockAccounts);

        const auditClientSpy = jest.spyOn(auditClientMock, "audit");

        const liqAdjustmentResult = await participantAgg.validateAndProcessLiquidityAdjustments(secCtx, mockAdjustments);

        //Assert
        expect(mockAuthorizationClient.rolesHavePrivilege).toHaveBeenCalledWith(
            secCtx.platformRoleIds,
            'CREATE_LIQUIDITY_ADJUSTMENT_BULK_REQUEST'
        );

        expect(mockRepo.fetchWhereIds).toHaveBeenCalledWith(['participant1']);
        expect(accBalSpy).toHaveBeenCalledWith(['2']);
        expect(auditClientSpy).toHaveBeenCalled();

        expect(liqAdjustmentResult).toEqual([
            {
                bankBalance: "2500.00",
                currencyCode: "USD",
                isDuplicate: false,
                matrixId: "MATRIX001",
                participantBankAccountInfo: "Bank Account 789",
                participantId: "participant1",
                participantName: "Participant 1",
                settledTransferAmount: "2500.00",
                settlementAccountId: "2",
                type: "OPERATOR_LIQUIDITY_ADJUSTMENT_CREDIT",
                updateAmount: "2500",
            }
        ]);


    });

    it("should throw an error when liquidityBalanceAdjustments is null", async () => {
        await expect(participantAgg.validateAndProcessLiquidityAdjustments(secCtx, null as any))
            .rejects.toThrow("Invalid data for liquidity balance adjustment.");
    });

    it("should throw an error for missing matrixId", async () => {
        const adjustments = [
            {
                matrixId: "", // Invalid matrixId
                isDuplicate: false,
                participantId: "P001",
                participantName: null,
                participantBankAccountInfo: "Bank Info",
                bankBalance: "1000.00",
                settledTransferAmount: "1000.00",
                currencyCode: "USD",
                type: null,
                updateAmount: null,
                settlementAccountId: null,
            },
        ];

        await expect(participantAgg.validateAndProcessLiquidityAdjustments(secCtx, adjustments))
            .rejects.toThrow("Invalid matrixId:  in liquidity balance adjustment.");
    });

    it("should throw an error for missing participantId", async () => {
        const adjustments = [
            {
                matrixId: "MATRIX001",
                isDuplicate: false,
                participantId: "", // Invalid participantId
                participantName: null,
                participantBankAccountInfo: "Bank Info",
                bankBalance: "1000.00",
                settledTransferAmount: "1000.00",
                currencyCode: "USD",
                type: null,
                updateAmount: null,
                settlementAccountId: null,
            },
        ];

        await expect(participantAgg.validateAndProcessLiquidityAdjustments(secCtx, adjustments))
            .rejects.toThrow("Invalid participantId:  in liquidity balance adjustment.");
    });

    it("should throw an error for missing bankBalance", async () => {
        const adjustments = [
            {
                matrixId: "MATRIX001",
                isDuplicate: false,
                participantId: "P001",
                participantName: null,
                participantBankAccountInfo: "Bank Info",
                bankBalance: "", // Invalid bankBalance
                settledTransferAmount: "1000.00",
                currencyCode: "USD",
                type: null,
                updateAmount: null,
                settlementAccountId: null,
            },
        ];

        await expect(participantAgg.validateAndProcessLiquidityAdjustments(secCtx, adjustments))
            .rejects.toThrow("Invalid bankbalance:  in liquidity balance adjustment.");
    });

    it("should throw an error for missing currencyCode", async () => {
        const adjustments = [
            {
                matrixId: "MATRIX001",
                isDuplicate: false,
                participantId: "P001",
                participantName: null,
                participantBankAccountInfo: "Bank Info",
                bankBalance: "1000.00",
                settledTransferAmount: "1000.00",
                currencyCode: "", // Invalid currencyCode
                type: null,
                updateAmount: null,
                settlementAccountId: null,
            },
        ];

        await expect(participantAgg.validateAndProcessLiquidityAdjustments(secCtx, adjustments))
            .rejects.toThrow("Invalid currencyCode:  in liquidity balance adjustment.");
    });

    /**
     * createLiquidityCheckRequestAdjustment()
     */
    it("should throw an error when liquidityBalanceAdjustments is null", async () => {
        await expect(participantAgg.createLiquidityCheckRequestAdjustment(secCtx, null as any, true))
            .rejects.toThrow("Invalid data for liquidity balance adjustment.");
    });

    it("should throw an error for missing matrixId", async () => {
        const adjustments = [
            {
                matrixId: "",// Invalid matrixId
                isDuplicate: false,
                participantId: "P001",
                participantName: null,
                participantBankAccountInfo: "Bank Info",
                bankBalance: "1000.00",
                settledTransferAmount: "1000.00",
                currencyCode: "USD",
                type: null,
                updateAmount: null,
                settlementAccountId: null,
            },
        ];

        await expect(participantAgg.createLiquidityCheckRequestAdjustment(secCtx, adjustments, true))
            .rejects.toThrow("Invalid matrixId:  in liquidity balance adjustment.");
    });

    it("should throw an error for missing participantId", async () => {
        const adjustments = [
            {
                matrixId: "MATRIX001",
                isDuplicate: false,
                participantId: "",//Invalid participantId
                participantName: null,
                participantBankAccountInfo: "Bank Info",
                bankBalance: "1000.00",
                settledTransferAmount: "1000.00",
                currencyCode: "USD",
                type: null,
                updateAmount: null,
                settlementAccountId: null,
            },
        ];

        await expect(participantAgg.createLiquidityCheckRequestAdjustment(secCtx, adjustments, true))
            .rejects.toThrow("Invalid participantId:  in liquidity balance adjustment.");
    });

    it("should throw an error for missing bankbalance", async () => {
        const adjustments = [
            {
                matrixId: "MATRIX001",
                isDuplicate: false,
                participantId: "P001",
                participantName: null,
                participantBankAccountInfo: "Bank Info",
                bankBalance: "",//Invalid bankbalance
                settledTransferAmount: "1000.00",
                currencyCode: "USD",
                type: null,
                updateAmount: null,
                settlementAccountId: null,
            },
        ];

        await expect(participantAgg.createLiquidityCheckRequestAdjustment(secCtx, adjustments, true))
            .rejects.toThrow("Invalid bankbalance:  in liquidity balance adjustment.");
    });

    it("should throw an error for missing currencyCode", async () => {
        const adjustments = [
            {
                matrixId: "MATRIX001",
                isDuplicate: false,
                participantId: "P001",
                participantName: null,
                participantBankAccountInfo: "Bank Info",
                bankBalance: "1000.00",
                settledTransferAmount: "1000.00",
                currencyCode: "",//Invalid currency
                type: null,
                updateAmount: null,
                settlementAccountId: null,
            },
        ];

        await expect(participantAgg.createLiquidityCheckRequestAdjustment(secCtx, adjustments, true))
            .rejects.toThrow("Invalid currencyCode:  in liquidity balance adjustment.");
    });

    /**
     * handleSettlementMatrixSettledEvt()
     * */
    it("should throw an error when msg null", async () => {

        await expect(participantAgg.handleSettlementMatrixSettledEvt(secCtx, null as any))
            .rejects.toThrow("Invalid participantList in SettlementMatrixSettledEvt message in handleSettlementMatrixSettledEvt()");
    });

    it("should update the participant's ndc information", async () => {
        const mockMsg: any = {
            boundedContextName: "participants-bc",
            aggregateId: "agg1",
            aggregateName: "participant-agg",
            msgKey: "",
            msgTopic: "",
            payload: {
                settlementMatrixId: "MATRIX001",
                settledTimestamp: Date.now(),
                participantList: [{
                    participantId: "participant1",
                    currencyCode: "USD",
                    settledDebitBalance: "10000",
                    settledCreditBalance: "0"
                }]
            }
        }

        //Act
        mockRepo.fetchWhereIds.mockResolvedValue([mockedParticipant1]);

        //Assert
        expect(participantAgg.handleSettlementMatrixSettledEvt(secCtx, mockMsg as any)).resolves;
    });

    it("should throw an error when cannot get participant's SETTLEMENT account", async () => {
        //Arrange
        const mockMsg: any = {
            boundedContextName: "participants-bc",
            aggregateId: "agg1",
            aggregateName: "participant-agg",
            msgKey: "",
            msgTopic: "",
            payload: {
                settlementMatrixId: "MATRIX001",
                settledTimestamp: Date.now(),
                participantList: [{
                    participantId: "participant1",
                    currencyCode: "USD",
                    settledDebitBalance: "10000",
                    settledCreditBalance: "0"
                }]
            }
        }

        const mockParticipant = mockedParticipant1;

        mockParticipant.netDebitCaps = [{
            currencyCode: "EUR",
            type: ParticipantNetDebitCapTypes.ABSOLUTE,
            percentage: null,
            currentValue: 10000,
        }];

        //Act
        mockRepo.fetchWhereIds.mockResolvedValue([mockedParticipant1]);

        //Assert
        await expect(participantAgg.handleSettlementMatrixSettledEvt(secCtx, mockMsg as any)).rejects
            .toThrow("Cannot get settlement account for participant with id: participant1 and currency: EUR for _updateNdcForParticipants()");
    });

    it("should throw an error when cannot find the participant's account in COA", async () => {
        //Arrange
        const mockMsg: any = {
            boundedContextName: "participants-bc",
            aggregateId: "agg1",
            aggregateName: "participant-agg",
            msgKey: "",
            msgTopic: "",
            payload: {
                settlementMatrixId: "MATRIX001",
                settledTimestamp: Date.now(),
                participantList: [{
                    participantId: "participant1",
                    currencyCode: "USD",
                    settledDebitBalance: "10000",
                    settledCreditBalance: "0"
                }]
            }
        }

        const mockParticipant = mockedParticipant1;

        mockParticipant.netDebitCaps = [{
            currencyCode: "USD",
            type: ParticipantNetDebitCapTypes.ABSOLUTE,
            percentage: null,
            currentValue: 10000,
        }];

        //Act
        jest.spyOn(accAndBalAdapterMock, "getAccount").mockResolvedValueOnce(null as any);

        mockRepo.fetchWhereIds.mockResolvedValue([mockedParticipant1]);

        //Assert
        await expect(participantAgg.handleSettlementMatrixSettledEvt(secCtx, mockMsg as any)).rejects
            .toThrow("Cannot get participant account with id: 2 from accounts and balaces for _updateNdcForParticipants()");
    });

    it("should throw an error when a participant does not have required accounts (SETTLEMENT or POSITION)", async () => {
        // Arrange
        const mockMsg: any = {
            boundedContextName: "participants-bc",
            aggregateId: "agg1",
            aggregateName: "participant-agg",
            msgKey: "",
            msgTopic: "",
            payload: {
                settlementMatrixId: "MATRIX001",
                settledTimestamp: Date.now(),
                participantList: [
                    {
                        participantId: "participant1",
                        currencyCode: "USD",
                        settledDebitBalance: "10000",
                        settledCreditBalance: "0"
                    }
                ]
            }
        };

        const mockParticipants = [
            {
                id: "participant1",
                participantAccounts: [
                    {
                        id: "acc1",
                        type: "POSITION",
                        currencyCode: "EUR" // Does not match the currency in the message
                    }
                ]
            }
        ];
        // Act 
        mockRepo.fetchWhereIds.mockResolvedValueOnce(mockParticipants);

        // Assert
        await expect(participantAgg.handleSettlementMatrixSettledEvt(secCtx, mockMsg))
            .rejects
            .toThrow("Could not get all participants' accounts for handleSettlementMatrixSettledEvt()");
    });

    /**
     * activateParticipant()
     * */

    it("should throw an error when participantId is null or empty", async () => {


        // Assert
        await expect(participantAgg.activateParticipant(secCtx, "", ""))
            .rejects
            .toThrow("[id] cannot be empty");
    });

    it("should throw an error when participantId is hub", async () => {

        // Assert
        await expect(participantAgg.activateParticipant(secCtx, "hub", ""))
            .rejects
            .toThrow("Cannot perform this action on the hub participant");
    });


    it("should log warning if the participant is already active", async () => {

        //Arrange 
        let mockParticipant = mockedParticipant1;
        mockParticipant.isActive = true;

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        expect(participantAgg.activateParticipant(secCtx, "participant1", "")).resolves;
    });


    /**
     * deactivateParticipant()
     * */

    it("should throw an error when participantId is null or empty", async () => {


        // Assert
        await expect(participantAgg.deactivateParticipant(secCtx, "", ""))
            .rejects
            .toThrow("[id] cannot be empty");
    });

    it("should throw an error when participantId is hub", async () => {

        // Assert
        await expect(participantAgg.deactivateParticipant(secCtx, "hub", ""))
            .rejects
            .toThrow("Cannot perform this action on the hub participant");
    });

    it("should throw an error when the participant has not found", async () => {
        //Arrange
        mockRepo.fetchWhereId.mockResolvedValue(null);

        // Assert
        await expect(participantAgg.deactivateParticipant(secCtx, "P01", ""))
            .rejects
            .toThrow("Participant with ID: 'P01' not found.");
    });

    it("should deactivate a participant and trigger related actions", async () => {
        const participantId = "participant1";
        const note = "Deactivating due to inactivity";


        let existingParticipant = mockedParticipant1;
        existingParticipant.isActive = true;

        // Mock repository to return the existing participant
        mockRepo.fetchWhereId.mockResolvedValue(existingParticipant);
        // Mock repository to simulate successful store
        mockRepo.store.mockResolvedValue(true);

        const auditSpy = jest.spyOn(auditClientMock, "audit");
        const loggerSpy = jest.spyOn(logger, "info");

        // Act
        await participantAgg.deactivateParticipant(secCtx, participantId, note);

        // Assert
        expect(existingParticipant.isActive).toBe(false);

        const changeLogForDeactive = existingParticipant.changeLog.filter((log) => log.changeType === ParticipantChangeTypes.DEACTIVATE);
        expect(changeLogForDeactive).toBeTruthy;

        expect(mockRepo.store).toHaveBeenCalledWith(existingParticipant);



        expect(auditSpy).toHaveBeenCalledWith(
            "PARTICIPANT_DISABLED",
            true,
            expect.anything(),
            [{ key: "participantId", value: participantId }]
        );

        expect(loggerSpy).toHaveBeenCalledWith(
            `Successfully deactivated participant with ID: '${participantId}'`
        );
    });

    /**
     * getParticipantChangeType()
     * */
    it("should return OPERATOR_FUNDS_DEPOSIT for ParticipantFundsMovementTypes.OPERATOR_FUNDS_DEPOSIT", () => {
        const result = participantAgg.getParticipantChangeType(ParticipantFundsMovementTypes.OPERATOR_FUNDS_DEPOSIT);
        expect(result).toBe(ParticipantChangeTypes.OPERATOR_FUNDS_DEPOSIT);
    });

    it("should return OPERATOR_FUNDS_WITHDRAWAL for ParticipantFundsMovementTypes.OPERATOR_FUNDS_WITHDRAWAL", () => {
        const result = participantAgg.getParticipantChangeType(ParticipantFundsMovementTypes.OPERATOR_FUNDS_WITHDRAWAL);
        expect(result).toBe(ParticipantChangeTypes.OPERATOR_FUNDS_WITHDRAWAL);
    });

    it("should return OPERATOR_LIQUIDITY_ADJUSTMENT_CREDIT for ParticipantFundsMovementTypes.OPERATOR_LIQUIDITY_ADJUSTMENT_CREDIT", () => {
        const result = participantAgg.getParticipantChangeType(ParticipantFundsMovementTypes.OPERATOR_LIQUIDITY_ADJUSTMENT_CREDIT);
        expect(result).toBe(ParticipantChangeTypes.OPERATOR_LIQUIDITY_ADJUSTMENT_CREDIT);
    });

    it("should return OPERATOR_LIQUIDITY_ADJUSTMENT_DEBIT for other types", () => {
        const result = participantAgg.getParticipantChangeType(ParticipantFundsMovementTypes.MATRIX_SETTLED_AUTOMATIC_ADJUSTMENT_DEBIT);
        expect(result).toBe(ParticipantChangeTypes.OPERATOR_LIQUIDITY_ADJUSTMENT_DEBIT);
    });


    /**
     * approveParticipantContactInfoChangeRequest()
     * */
    it("should throw an error when participantId is null or empty", async () => {
        // Assert
        await expect(participantAgg.approveParticipantContactInfoChangeRequest(secCtx, "", ""))
            .rejects
            .toThrow("[id] cannot be empty");
    });

    it("should throw an error when participantId is hub", async () => {

        // Assert
        await expect(participantAgg.approveParticipantContactInfoChangeRequest(secCtx, "hub", ""))
            .rejects
            .toThrow("Cannot perform this action on the hub participant");
    });

    it("should throw an error for the contact info change request if the contact name already exists", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.isActive = true;
        mockParticipant.participantContacts = [{
            id: "contact1",
            name: "John Doe",
            email: "john.doe@example.com",
            phoneNumber: "+123456789",
            role: "staff"
        }];

        mockRepo.store(mockParticipant);

        mockParticipant.participantContactInfoChangeRequests = [{
            contactInfoId: "12345",
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO",
            // IParticipantContactInfo fields
            name: "John Doe",
            email: "john.doe@example.com",
            phoneNumber: "+123456789",
            id: "12345",
            role: "staff"
        }];

        // Assert
        await expect(participantAgg.approveParticipantContactInfoChangeRequest(secCtx, "participant1", "12345"))
            .rejects
            .toThrow("Same contact name already exists.");
    });

    it("should throw an error for the contact info change request if the contact email already exists", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.isActive = true;
        mockParticipant.participantContacts = [{
            id: "contact1",
            name: "John Doe",
            email: "john.doe@example.com",
            phoneNumber: "+123456789",
            role: "staff"
        }];

        mockRepo.store(mockParticipant);

        mockParticipant.participantContactInfoChangeRequests = [{
            contactInfoId: "12345",
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_PARTICIPANT_CONTACT_INFO",
            // IParticipantContactInfo fields
            name: "Aung Aung",
            email: "john.doe@example.com",
            phoneNumber: "+123456789",
            id: "12345",
            role: "staff"
        }];

        // Assert
        await expect(participantAgg.approveParticipantContactInfoChangeRequest(secCtx, "participant1", "12345"))
            .rejects
            .toThrow("Same contact email already exists.");
    });

    it("should throw an error for the contact info change request if Same contact information already exists.", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.isActive = true;
        mockParticipant.participantContacts = [{
            id: "contact1",
            name: "John Doe",
            email: "john.doe@example.com",
            phoneNumber: "+123456789",
            role: "staff"
        }];

        mockRepo.store(mockParticipant);

        mockParticipant.participantContactInfoChangeRequests = [{
            contactInfoId: "12345",
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_CONTACT_INFO",
            // IParticipantContactInfo fields
            name: "John Doe",
            email: "john.doe@example.com",
            phoneNumber: "+123456789",
            id: "12345",
            role: "staff"
        }];

        // Assert
        await expect(participantAgg.approveParticipantContactInfoChangeRequest(secCtx, "participant1", "12345"))
            .rejects
            .toThrow("Same contact information already exists.");
    });

    it("should throw an error if contact info change request failed to save", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.isActive = true;
        mockParticipant.participantContacts = [];



        mockParticipant.participantContactInfoChangeRequests = [{
            contactInfoId: "12345",
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_CONTACT_INFO",
            // IParticipantContactInfo fields
            name: "John Doe",
            email: "john.doe@example.com",
            phoneNumber: "+123456789",
            id: "12345",
            role: "staff"
        }];

        mockRepo.store.mockResolvedValue(false);
        // Assert
        await expect(participantAgg.approveParticipantContactInfoChangeRequest(secCtx, "participant1", "12345"))
            .rejects
            .toThrow("Could not update participant on adding participant's contact info.");
    });

    /**
     * rejectParticipantContactInfoChangeRequest()
     * */

    it("should throw an error when participantId is null or empty", async () => {
        // Assert
        await expect(participantAgg.rejectParticipantContactInfoChangeRequest(secCtx, "", ""))
            .rejects
            .toThrow("[id] cannot be empty");
    });

    it("should throw an error when participantId is hub", async () => {

        // Assert
        await expect(participantAgg.rejectParticipantContactInfoChangeRequest(secCtx, "hub", ""))
            .rejects
            .toThrow("Cannot perform this action on the hub participant");
    });

    it("should throw an error when the participant has not found", async () => {
        //Arrange
        mockRepo.fetchWhereId.mockResolvedValue(null);

        // Assert
        await expect(participantAgg.rejectParticipantContactInfoChangeRequest(secCtx, "participant1", "12345"))
            .rejects
            .toThrow("Participant with ID: 'participant1' not found.");
    });

    it("should throw an error if contact info change request not found", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantContacts = [];

        mockParticipant.participantContactInfoChangeRequests = [{
            contactInfoId: "12345",
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_CONTACT_INFO",
            // IParticipantContactInfo fields
            name: "John Doe",
            email: "john.doe@example.com",
            phoneNumber: "+123456789",
            id: "12345",
            role: "staff"
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.rejectParticipantContactInfoChangeRequest(secCtx, "participant1", "non-existing"))
            .rejects
            .toThrow("Cannot find a participant's contact info change request with id: non-existing");
    });

    it("should throw an error if contact info change request is already rejected", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantContacts = [];

        mockParticipant.participantContactInfoChangeRequests = [{
            contactInfoId: "12345",
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.REJECTED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_CONTACT_INFO",
            // IParticipantContactInfo fields
            name: "John Doe",
            email: "john.doe@example.com",
            phoneNumber: "+123456789",
            id: "12345",
            role: "staff"
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.rejectParticipantContactInfoChangeRequest(secCtx, "participant1", "12345"))
            .rejects
            .toThrow("Participant's contact info change request with id: 12345 is already rejected");
    });


    /**
     * createParticipantStatusChangeRequest()
     * */

    it("should throw an error when participantId is null or empty", async () => {
        // Assert
        await expect(participantAgg.createParticipantStatusChangeRequest(secCtx, "", null as any))
            .rejects
            .toThrow("[id] cannot be empty");
    });

    it("should throw an error when participantId is hub", async () => {

        // Assert
        await expect(participantAgg.createParticipantStatusChangeRequest(secCtx, "hub", null as any))
            .rejects
            .toThrow("Cannot perform this action on the hub participant");
    });

    it("should throw an error when the participant has not found", async () => {
        //Arrange
        mockRepo.fetchWhereId.mockResolvedValue(null);

        // Assert
        await expect(participantAgg.createParticipantStatusChangeRequest(secCtx, "participant1", null as any))
            .rejects
            .toThrow("Participant with ID: 'participant1' not found.");
    });

    it("should throw an error when updating participant status change request failed.", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantStatusChangeRequests = null as any;

        const mockStatusChangeRequest: IParticipantStatusChangeRequest = {
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.REJECTED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS",
            id: "12345",
            isActive: true,
        };

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);
        mockRepo.store.mockResolvedValue(false);

        // Assert
        await expect(participantAgg.createParticipantStatusChangeRequest(secCtx, "participant1", mockStatusChangeRequest))
            .rejects
            .toThrow("Could not update participant's status on change request.");
    });

    /**
     * approveParticipantStatusChangeRequest()
     * */

    it("should throw an error when participantId is null or empty", async () => {
        // Assert
        await expect(participantAgg.approveParticipantStatusChangeRequest(secCtx, "", null as any))
            .rejects
            .toThrow("[id] cannot be empty");
    });

    it("should throw an error when participantId is hub", async () => {

        // Assert
        await expect(participantAgg.approveParticipantStatusChangeRequest(secCtx, "hub", null as any))
            .rejects
            .toThrow("Cannot perform this action on the hub participant");
    });

    it("should throw an error when the participant has not found", async () => {
        //Arrange
        mockRepo.fetchWhereId.mockResolvedValue(null);

        // Assert
        await expect(participantAgg.approveParticipantStatusChangeRequest(secCtx, "participant1", null as any))
            .rejects
            .toThrow("Participant with ID: 'participant1' not found.");
    });

    it("should throw an error if status change request not found", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantStatusChangeRequests = [];

        mockParticipant.participantStatusChangeRequests = [{
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.APPROVED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS",
            id: "12345",
            isActive: true,
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.approveParticipantStatusChangeRequest(secCtx, "participant1", "111"))
            .rejects
            .toThrow("Cannot find a participant's status change request with id: 111");
    });

    it("should throw an error if status change request already approved", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantStatusChangeRequests = [];

        mockParticipant.participantStatusChangeRequests = [{
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.APPROVED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS",
            id: "12345",
            isActive: true,
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.approveParticipantStatusChangeRequest(secCtx, "participant1", "12345"))
            .rejects
            .toThrow("Participant's status change request with id: 12345 is already approved.");
    });

    it("should throw an error when updating participant status change request failed.", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantStatusChangeRequests = null as any;

        mockParticipant.participantStatusChangeRequests = [{
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.REJECTED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS",
            id: "12345",
            isActive: true,
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);
        mockRepo.store.mockResolvedValue(false);

        // Assert
        await expect(participantAgg.approveParticipantStatusChangeRequest(secCtx, "participant1", "12345"))
            .rejects
            .toThrow("Could not approve participant status change request.");
    });


    /**
     * rejectParticipantStatusChangeRequest()
     * */

    it("should throw an error when participantId is null or empty", async () => {
        // Assert
        await expect(participantAgg.rejectParticipantStatusChangeRequest(secCtx, "", null as any))
            .rejects
            .toThrow("[id] cannot be empty");
    });

    it("should throw an error when participantId is hub", async () => {

        // Assert
        await expect(participantAgg.rejectParticipantStatusChangeRequest(secCtx, "hub", null as any))
            .rejects
            .toThrow("Cannot perform this action on the hub participant");
    });

    it("should throw an error when the participant has not found", async () => {
        //Arrange
        mockRepo.fetchWhereId.mockResolvedValue(null);

        // Assert
        await expect(participantAgg.rejectParticipantStatusChangeRequest(secCtx, "participant1", null as any))
            .rejects
            .toThrow("Participant with ID: 'participant1' not found.");
    });

    it("should throw an error if status change request not found", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantStatusChangeRequests = [];

        mockParticipant.participantStatusChangeRequests = [{
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.APPROVED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS",
            id: "12345",
            isActive: true,
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.rejectParticipantStatusChangeRequest(secCtx, "participant1", "111"))
            .rejects
            .toThrow("Cannot find a participant's status change request with id: 111");
    });

    it("should throw an error if status change request already approved", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantStatusChangeRequests = [];

        mockParticipant.participantStatusChangeRequests = [{
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.APPROVED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS",
            id: "12345",
            isActive: true,
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.rejectParticipantStatusChangeRequest(secCtx, "participant1", "12345"))
            .rejects
            .toThrow("Participant's status change request with id: 12345 is already approved.");
    });


    it("should throw an error if status change request already rejected", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantStatusChangeRequests = [];

        mockParticipant.participantStatusChangeRequests = [{
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.REJECTED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS",
            id: "12345",
            isActive: true,
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.rejectParticipantStatusChangeRequest(secCtx, "participant1", "12345"))
            .rejects
            .toThrow("Participant's status change request with id: 12345 is already rejected.");
    });


    it("should throw an error when updating participant status change request failed.", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantStatusChangeRequests = null as any;

        mockParticipant.participantStatusChangeRequests = [{
            createdBy: "adminUser",
            createdDate: 1698316800000, // Example timestamp (Unix epoch in milliseconds)
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "managerUser",
            approvedDate: 1698403200000, // Example timestamp (Unix epoch in milliseconds)
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_PARTICIPANT_STATUS",
            id: "12345",
            isActive: true,
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);
        mockRepo.store.mockResolvedValue(false);

        // Assert
        await expect(participantAgg.rejectParticipantStatusChangeRequest(secCtx, "participant1", "12345"))
            .rejects
            .toThrow("Could not reject participant status change request.");
    });


    /**
     * getAllowedSourceIpsByParticipantId()
     * */
    it("should throw an error when the participant has not found", async () => {
        //Arrange
        mockRepo.fetchWhereId.mockResolvedValue(null);

        // Assert
        await expect(participantAgg.getAllowedSourceIpsByParticipantId(secCtx, "participant1"))
            .rejects
            .toThrow("Participant with ID: 'participant1' not found.");
    });

    /**
     * approveParticipantSourceIpChangeRequest()
     * */
    it("should throw an error if source IP change request not found", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantSourceIpChangeRequests = [];

        mockParticipant.participantSourceIpChangeRequests = [{
            allowedSourceIpId: "67890",
            createdBy: "networkAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.APPROVED,
            approvedBy: "securityManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_SOURCE_IP",
            id: "sourceIp-123",
            cidr: "192.168.1.0/24",
            portMode: ParticipantAllowedSourceIpsPortModes.SPECIFIC,
            ports: [80, 443],
            portRange: {
                rangeFirst: 8000,
                rangeLast: 8080,
            },
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.approveParticipantSourceIpChangeRequest(secCtx, "participant1", "non-existing-id"))
            .rejects
            .toThrow("Cannot find a participant's sourceIP change request with id: non-existing-id");
    });

    it("should throw an error updating participant sourceIP change request failed.", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantSourceIpChangeRequests = [];

        mockParticipant.participantAllowedSourceIps = [];

        mockParticipant.participantSourceIpChangeRequests = [{
            allowedSourceIpId: "67890",
            createdBy: "networkAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "securityManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_SOURCE_IP",
            id: "sourceIp-123",
            cidr: "192.168.1.0/24",
            portMode: ParticipantAllowedSourceIpsPortModes.SPECIFIC,
            ports: [80, 443],
            portRange: {
                rangeFirst: 8000,
                rangeLast: 8080,
            },
        }];

        mockRepo.store.mockResolvedValue(false);

        // Assert
        await expect(participantAgg.approveParticipantSourceIpChangeRequest(secCtx, "participant1", "sourceIp-123"))
            .rejects
            .toThrow("Could not update participant on approveParticipantSourceIPChangeRequest");
    });

    /**
     * rejectParticipantSourceIpChangeRequest()
     * */
    it("should throw an error if status change request not found", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantSourceIpChangeRequests = [];

        mockParticipant.participantAllowedSourceIps = [];

        mockParticipant.participantSourceIpChangeRequests = [{
            allowedSourceIpId: "67890",
            createdBy: "networkAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "securityManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_SOURCE_IP",
            id: "sourceIp-123",
            cidr: "192.168.1.0/24",
            portMode: ParticipantAllowedSourceIpsPortModes.SPECIFIC,
            ports: [80, 443],
            portRange: {
                rangeFirst: 8000,
                rangeLast: 8080,
            },
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.rejectParticipantSourceIpChangeRequest(secCtx, "participant1", "111"))
            .rejects
            .toThrow("Cannot find a participant's sourceIP change request with id: 111");
    });

    it("should throw an error if status change request already approved", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantSourceIpChangeRequests = [];

        mockParticipant.participantAllowedSourceIps = [];

        mockParticipant.participantSourceIpChangeRequests = [{
            allowedSourceIpId: "67890",
            createdBy: "networkAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.APPROVED,
            approvedBy: "securityManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_SOURCE_IP",
            id: "sourceIp-123",
            cidr: "192.168.1.0/24",
            portMode: ParticipantAllowedSourceIpsPortModes.SPECIFIC,
            ports: [80, 443],
            portRange: {
                rangeFirst: 8000,
                rangeLast: 8080,
            },
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.rejectParticipantSourceIpChangeRequest(secCtx, "participant1", "sourceIp-123"))
            .rejects
            .toThrow("Participant's sourceIP change request with id: sourceIp-123 is already approved");
    });


    it("should throw an error if status change request already rejected", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantSourceIpChangeRequests = [];

        mockParticipant.participantAllowedSourceIps = [];

        mockParticipant.participantSourceIpChangeRequests = [{
            allowedSourceIpId: "67890",
            createdBy: "networkAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.REJECTED,
            approvedBy: "securityManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_SOURCE_IP",
            id: "sourceIp-123",
            cidr: "192.168.1.0/24",
            portMode: ParticipantAllowedSourceIpsPortModes.SPECIFIC,
            ports: [80, 443],
            portRange: {
                rangeFirst: 8000,
                rangeLast: 8080,
            },
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.rejectParticipantSourceIpChangeRequest(secCtx, "participant1", "sourceIp-123"))
            .rejects
            .toThrow("Participant's sourceIP change request with id: sourceIp-123 is already rejected");
    });

    /**
     * createParticipantAccountChangeRequest()
     * */
    it("should throw an error for invalid account change requestType", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantAccountsChangeRequest = [];

        mockParticipant.participantAccountsChangeRequest = [{
            id: "request-98765",
            accountId: "account-54321",
            type: ParticipantAccountTypes.SETTLEMENT,
            currencyCode: "USD",
            externalBankAccountId: "bankAccount-12345",
            externalBankAccountName: "John Doe Settlement Account",
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.APPROVED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "INVALID_TYPE" as any,
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.createParticipantAccountChangeRequest(secCtx, "participant1", mockParticipant.participantAccountsChangeRequest[0]))
            .rejects
            .toThrow("Invalid requestType on ParticipantAccountChangeRequest");


    });

    it("should throw an error creating duplicate account change request", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantAccountsChangeRequest = [];

        mockParticipant.participantAccountsChangeRequest = [{
            id: "request-98765",
            accountId: "account-54321",
            type: ParticipantAccountTypes.SETTLEMENT,
            currencyCode: "USD",
            externalBankAccountId: "bankAccount-12345",
            externalBankAccountName: "John Doe Settlement Account",
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.APPROVED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_ACCOUNT_BANK_DETAILS",
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);
        // Assert
        await expect(participantAgg.createParticipantAccountChangeRequest(secCtx, "participant1",
            mockParticipant.participantAccountsChangeRequest[0]))
            .rejects
            .toThrow("Account create request with the same information exists already");

    });

    it("should throw an error when updating participant account change request failed.", async () => {
        //Arrange

        const mockAccountsChangeRequest = {
            id: "request-98765",
            accountId: "account-54321",
            type: ParticipantAccountTypes.SETTLEMENT,
            currencyCode: "EUR",
            externalBankAccountId: "bankAccount-12345",
            externalBankAccountName: "John Doe Settlement Account",
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_ACCOUNT_BANK_DETAILS" as any,
        };

        mockRepo.store.mockResolvedValue(false);
        // Assert
        await expect(participantAgg.createParticipantAccountChangeRequest(secCtx, "participant1",
            mockAccountsChangeRequest))
            .rejects
            .toThrow("Could not update participant on addParticipantAccount");

    });

    it("should throw an error if change request account type is not SETTLEMENT and given the externalBankAccountId & externalBankAccountName.", async () => {
        //Arrange
        const mockParticipant = mockedParticipant1;
        mockParticipant.participantAccounts = [{
            id: "request-98765",
            type: ParticipantAccountTypes.POSITION,
            currencyCode: "EUR",
            externalBankAccountId: "bankAccount-12345",
            externalBankAccountName: "John Doe Settlement Account",
            debitBalance: "10000",
            creditBalance: "0",
            balance: "10000"
        }];

        const mockAccountsChangeRequest = {
            id: "request-98765",
            accountId: "account-54321",
            type: ParticipantAccountTypes.POSITION,
            currencyCode: "EUR",
            externalBankAccountId: "bankAccount-12345",
            externalBankAccountName: "John Doe Settlement Account",
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_ACCOUNT_BANK_DETAILS" as any,
        };

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);
        // Assert
        await expect(participantAgg.createParticipantAccountChangeRequest(secCtx, "participant1",
            mockAccountsChangeRequest))
            .rejects
            .toThrow("Only the SETTLEMENT account type can have external bank account info.");

    });

    it("should throw an error if the account change request comes from a non-hub participant with HUB_MULTILATERAL_SETTLEMENT or HUB_RECONCILIATION.", async () => {
        //Arrange

        const mockAccountsChangeRequest = {
            id: "request-98765",
            accountId: "account-54321",
            type: ParticipantAccountTypes.HUB_MULTILATERAL_SETTLEMENT,
            currencyCode: "EUR",
            externalBankAccountId: null,
            externalBankAccountName: null,
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_ACCOUNT_BANK_DETAILS" as any,
        };

        // Assert
        await expect(participantAgg.createParticipantAccountChangeRequest(secCtx, "participant1",
            mockAccountsChangeRequest))
            .rejects
            .toThrow("Only the hub can have accounts of type HUB_MULTILATERAL_SETTLEMENT or HUB_RECONCILIATION");

    });

    /**
     * rejectParticipantAccountChangeRequest()
     * */
    it("should throw an error account change request is already approved", async () => {
        //Arrange
        const mockParticipant = mockedParticipant1;
        mockParticipant.participantAccountsChangeRequest = [{
            id: "request-98765",
            accountId: "account-54321",
            type: ParticipantAccountTypes.SETTLEMENT,
            currencyCode: "EUR",
            externalBankAccountId: null,
            externalBankAccountName: null,
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.APPROVED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_ACCOUNT_BANK_DETAILS" as any,
        }];

        //Act
        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        //Assert
        await expect(participantAgg.rejectParticipantAccountChangeRequest(secCtx, "participant1", "request-98765"))
            .rejects
            .toThrow("Participant's account change request with id: request-98765 is already approved");
    });

    it("should throw an error account change request is already rejected", async () => {
        //Arrange
        const mockParticipant = mockedParticipant1;
        mockParticipant.participantAccountsChangeRequest = [{
            id: "request-98765",
            accountId: "account-54321",
            type: ParticipantAccountTypes.SETTLEMENT,
            currencyCode: "EUR",
            externalBankAccountId: null,
            externalBankAccountName: null,
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.REJECTED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_ACCOUNT_BANK_DETAILS" as any,
        }];

        //Act
        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        //Assert
        await expect(participantAgg.rejectParticipantAccountChangeRequest(secCtx, "participant1", "request-98765"))
            .rejects
            .toThrow("Participant's account change request with id: request-98765 is already rejected");
    });

    it("should throw an error for invalid account change requestType", async () => {
        //Arrange

        const mockParticipant = mockedParticipant1;
        mockParticipant.participantAccountsChangeRequest = [{
            id: "request-98765",
            accountId: "account-54321",
            type: ParticipantAccountTypes.SETTLEMENT,
            currencyCode: "USD",
            externalBankAccountId: "bankAccount-12345",
            externalBankAccountName: "John Doe Settlement Account",
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "INVALID_TYPE" as any,
        }];


        mockRepo.store(mockParticipant);

        // Assert
        await expect(participantAgg.rejectParticipantAccountChangeRequest(secCtx, "participant1", "request-98765"))
            .rejects
            .toThrow("Invalid requestType on ParticipantAccountChangeRequest");


    });

    it("should throw an error when updating participant account change request failed.", async () => {
        //Arrange
        const mockParticipant = mockedParticipant1;
        mockParticipant.participantAccountsChangeRequest = [{
            id: "request-98765",
            accountId: "account-54321",
            type: ParticipantAccountTypes.SETTLEMENT,
            currencyCode: "EUR",
            externalBankAccountId: "bankAccount-12345",
            externalBankAccountName: "John Doe Settlement Account",
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_ACCOUNT_BANK_DETAILS" as any,
        }];

        mockRepo.store(mockParticipant);

        mockRepo.store.mockResolvedValue(false);
        // Assert
        await expect(participantAgg.rejectParticipantAccountChangeRequest(secCtx, "participant1",
            "request-98765"))
            .rejects
            .toThrow("Could not update participant on addParticipantAccount");

    });


    /**
     * approveParticipantAccountChangeRequest()
     * */


    it("should throw an error for invalid account change requestType", async () => {
        //Arrange

        const mockParticipant = mockedParticipant1;
        mockParticipant.participantAccountsChangeRequest = [{
            id: "request-98765",
            accountId: "account-54321",
            type: ParticipantAccountTypes.SETTLEMENT,
            currencyCode: "USD",
            externalBankAccountId: "bankAccount-12345",
            externalBankAccountName: "John Doe Settlement Account",
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "INVALID_TYPE" as any,
        }];


        mockRepo.store(mockParticipant);

        // Assert
        await expect(participantAgg.approveParticipantAccountChangeRequest(secCtx, "participant1", "request-98765"))
            .rejects
            .toThrow("Invalid requestType on ParticipantAccountChangeRequest");


    });

    it("should throw an error when updating participant account change request failed.", async () => {
        //Arrange
        const mockParticipant = mockedParticipant1;
        mockParticipant.participantAccountsChangeRequest = [{
            id: "request-98765",
            accountId: "account-54321",
            type: ParticipantAccountTypes.SETTLEMENT,
            currencyCode: "EUR",
            externalBankAccountId: "bankAccount-12345",
            externalBankAccountName: "John Doe Settlement Account",
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "CHANGE_ACCOUNT_BANK_DETAILS" as any,
        }];

        mockRepo.store(mockParticipant);

        mockRepo.store.mockResolvedValue(false);
        // Assert
        await expect(participantAgg.approveParticipantAccountChangeRequest(secCtx, "participant1",
            "request-98765"))
            .rejects
            .toThrow("Could not update participant on addParticipantAccount");

    });

    it("should throw an error if an approving account already exists", async () => {
        //Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.participantAccountsChangeRequest = [];

        mockParticipant.participantAccounts = [{
            id: "account-54321",
            type: ParticipantAccountTypes.SETTLEMENT,
            currencyCode: "USD",
            externalBankAccountId: "bankAccount-12345",
            externalBankAccountName: "John Doe Settlement Account",
            debitBalance: "10000",
            creditBalance: "0",
            balance: "10000"
        }]

        mockParticipant.participantAccountsChangeRequest = [{
            id: "request-98765",
            accountId: null,
            type: ParticipantAccountTypes.SETTLEMENT,
            currencyCode: "USD",
            externalBankAccountId: "bankAccount-12345",
            externalBankAccountName: "John Doe Settlement Account",
            createdBy: "financeAdmin",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: "seniorFinanceManager",
            approvedDate: 1698403200000,
            rejectedBy: null,
            rejectedDate: null,
            requestType: "ADD_ACCOUNT",
        }];

        //Act
        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.approveParticipantAccountChangeRequest(secCtx, "participant1",
            'request-98765'))
            .rejects
            .toThrow("An account with that id, or the same type and currency exists already");

    });

    /**
     * createFundsMovement()
     * */
    it("should throw an error for invalid funds movement type", async () => {
        // Arrange

        const mockFundsMovement = {
            id: "fundsMovement-001",
            createdBy: "financeOperator",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            type: "Invalid Type" as any,
            currencyCode: null as any,
            amount: null as any,
            journalEntryId: null,
            extReference: "extRef-12345",
            note: "Initial deposit for operational funds.",
        }

        // Assert
        await expect(participantAgg.createFundsMovement(secCtx, "participant1",
            mockFundsMovement))
            .rejects
            .toThrow("Invalid funds movement type.");

        mockFundsMovement.type = ParticipantFundsMovementTypes.OPERATOR_FUNDS_DEPOSIT;

        await expect(participantAgg.createFundsMovement(secCtx, "participant1",
            mockFundsMovement))
            .rejects
            .toThrow("currencyCode cannot be empty");

        mockFundsMovement.currencyCode = "USD";

        await expect(participantAgg.createFundsMovement(secCtx, "participant1",
            mockFundsMovement))
            .rejects
            .toThrow("amount cannot be empty");
    })

    it("should throw an error when updating participant account change request failed.", async () => {
        //Arrange

        mockRepo.fetchWhereId.mockResolvedValueOnce(mockedParticipant1);
        mockRepo.fetchWhereId.mockResolvedValueOnce(mockedParticipantHub);

        const mockFundsMovement = {
            id: "fundsMovement-001",
            createdBy: "financeOperator",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            type: ParticipantFundsMovementTypes.OPERATOR_FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "10000",
            journalEntryId: null,
            extReference: "extRef-12345",
            note: "Initial deposit for operational funds.",
        }


        mockRepo.store.mockResolvedValue(false);
        // Assert
        await expect(participantAgg.createFundsMovement(secCtx, "participant1",
            mockFundsMovement))
            .rejects
            .toThrow("Could not update participant on addParticipantAccount");

    });

    it("should throw an error if hub's settlement account not found", async () => {
        //Arrange

        const mockFundsMovement = {
            id: "fundsMovement-001",
            createdBy: "financeOperator",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            type: ParticipantFundsMovementTypes.OPERATOR_FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "10000",
            journalEntryId: null,
            extReference: "extRef-12345",
            note: "Initial deposit for operational funds.",
        }


        mockRepo.store.mockResolvedValue(false);
        // Assert
        await expect(participantAgg.createFundsMovement(secCtx, "participant1",
            mockFundsMovement))
            .rejects
            .toThrow("Cannot find hub's reconciliation account for currency: USD");

    });

    /**
     * approveFundsMovement()
     * */
    it("should throw an error when approving a fund movement with Id that doesn't exist", async () => {
        // Arrange
        const mockParticipant = mockedParticipant1;
        mockParticipant.fundsMovements = [];
        mockRepo.fetchWhereId.mockResolvedValue(mockedParticipant1);

        // Assert
        await expect(participantAgg.approveFundsMovement(secCtx, "participant1",
            "fundsMovement-001"))
            .rejects
            .toThrow("Cannot find a participant's funds movement with id: fundsMovement-001");

    })

    it("should throw an error if approving funds movement id was already approved", async () => {
        // Arrange
        const mockParticipant = mockedParticipant1;
        mockParticipant.fundsMovements = [{
            id: "fundsMovement-001",
            createdBy: "financeOperator",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.APPROVED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            type: ParticipantFundsMovementTypes.OPERATOR_FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "10000",
            journalEntryId: null,
            extReference: "extRef-12345",
            note: "Initial deposit for operational funds.",
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockedParticipant1);

        // Assert
        await expect(participantAgg.approveFundsMovement(secCtx, "participant1",
            "fundsMovement-001"))
            .rejects
            .toThrow("Participant's funds movement with id: fundsMovement-001 is already approved");


    })

    it("should throw an error if the participant is not active", async () => {
        // Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.isActive = false;

        mockParticipant.fundsMovements = [{
            id: "fundsMovement-001",
            createdBy: "financeOperator",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            type: ParticipantFundsMovementTypes.OPERATOR_FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "10000",
            journalEntryId: null,
            extReference: "extRef-12345",
            note: "Initial deposit for operational funds.",
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.approveFundsMovement(secCtx, "participant1",
            "fundsMovement-001"))
            .rejects
            .toThrow("Participant with ID: 'participant1' is not active");


    })

    it("should throw an error if the participant is not active", async () => {
        // Arrange
        let mockParticipant = mockedParticipant1;
        mockParticipant.isActive = false;

        mockParticipant.fundsMovements = [{
            id: "fundsMovement-001",
            createdBy: "financeOperator",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            type: ParticipantFundsMovementTypes.OPERATOR_FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "10000",
            journalEntryId: null,
            extReference: "extRef-12345",
            note: "Initial deposit for operational funds.",
        }];

        mockRepo.fetchWhereId.mockResolvedValue(mockParticipant);

        // Assert
        await expect(participantAgg.approveFundsMovement(secCtx, "participant1",
            "fundsMovement-001"))
            .rejects
            .toThrow("Participant with ID: 'participant1' is not active");


    })

    it("should throw an error if hub's HUB_RECONCILIATION account not found with approving account's currency", async () => {
        // Arrange
        let mockParticipant = mockedParticipant1;

        mockParticipant.fundsMovements = [{
            id: "fundsMovement-001",
            createdBy: "financeOperator",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            type: ParticipantFundsMovementTypes.OPERATOR_FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "10000",
            journalEntryId: null,
            extReference: "extRef-12345",
            note: "Initial deposit for operational funds.",
        }];

        mockRepo.store(mockParticipant);

    })

    it ("should throw an error if hub doesn't have HUB_RECONCILIATION account", async () => {

        let mockParticipant = mockedParticipant1;
        mockParticipant.isActive = true;

        mockParticipant.fundsMovements = [{
            id: "fundsMovement-001",
            createdBy: "financeOperator",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            type: ParticipantFundsMovementTypes.OPERATOR_FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "10000",
            journalEntryId: null,
            extReference: "extRef-12345",
            note: "Initial deposit for operational funds.",
        }];

        const hubParticipant = mockedParticipantHub;
        hubParticipant.participantAccounts = [];

        mockRepo.fetchWhereId.mockResolvedValueOnce(mockParticipant);
        mockRepo.fetchWhereId.mockResolvedValueOnce(hubParticipant);
        // Assert
        await expect(participantAgg.approveFundsMovement(secCtx, "participant1",
            "fundsMovement-001"))
            .rejects
            .toThrow("Cannot find a hub's assets account for currency: USD");

        
    })

    it ("should throw an error if hub doesn't have HUB_RECONCILIATION account", async () => {

        let mockParticipant = mockedParticipant1;
        mockParticipant.isActive = true;
        mockParticipant.participantAccounts = [];

        mockParticipant.fundsMovements = [{
            id: "fundsMovement-001",
            createdBy: "financeOperator",
            createdDate: 1698316800000,
            requestState: ApprovalRequestState.CREATED,
            approvedBy: null,
            approvedDate: null,
            rejectedBy: null,
            rejectedDate: null,
            type: ParticipantFundsMovementTypes.OPERATOR_FUNDS_DEPOSIT,
            currencyCode: "USD",
            amount: "10000",
            journalEntryId: null,
            extReference: "extRef-12345",
            note: "Initial deposit for operational funds.",
        }];

        const hubParticipant = mockedParticipantHub;
        hubParticipant.participantAccounts = [
            {
                id: "1",
                type: ParticipantAccountTypes.HUB_MULTILATERAL_SETTLEMENT,
                currencyCode: "USD",
                balance: null,
                creditBalance: null,
                debitBalance: null,
                externalBankAccountId: null,
                externalBankAccountName: null,
            }, {
                id: "2",
                type: ParticipantAccountTypes.HUB_RECONCILIATION,
                currencyCode: "USD",
                balance: null,
                creditBalance: null,
                debitBalance: null,
                externalBankAccountId: null,
                externalBankAccountName: null,
            }
        ];

        mockRepo.fetchWhereId.mockResolvedValueOnce(mockParticipant);
        mockRepo.fetchWhereId.mockResolvedValueOnce(hubParticipant);
        // Assert
        await expect(participantAgg.approveFundsMovement(secCtx, "participant1",
            "fundsMovement-001"))
            .rejects
            .toThrow("Cannot find a participant's settlement account for currency: USD");

    })

});
