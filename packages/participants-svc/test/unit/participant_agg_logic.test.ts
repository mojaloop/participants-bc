//import { ForbiddenError } from "some-error-library"; // Replace with actual import
import { ConsoleLogger, ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { ParticipantAggregate } from "../../src/domain/participant_agg"; // Replace with actual service path
import {
    CallSecurityContext,
    ForbiddenError,
} from "@mojaloop/security-bc-public-types-lib";
import { AccountsBalancesAdapterMock, AuditClientMock, AuthorizationClientMock, MemoryConfigClientMock, MemoryMessageProducer, mockedParticipant1, mockedParticipant2, mockedParticipantHub, TokenHelperMock } from "@mojaloop/participants-bc-shared-mocks-lib";
import { MetricsMock } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { IParticipantLiquidityBalanceAdjustment, IParticipantNetDebitCap, ParticipantChangeTypes, ParticipantFundsMovementTypes, ParticipantNetDebitCapTypes } from "@mojaloop/participant-bc-public-types-lib";
import { AccountsAndBalancesAccount } from "@mojaloop/accounts-and-balances-bc-public-types-lib";
import { SettlementMatrixSettledEvt } from "@mojaloop/platform-shared-lib-public-messages-lib";
import { MessageTypes } from "@mojaloop/platform-shared-lib-messaging-types-lib";

const authTokenUrl = "mocked_auth_url";
const hasPrivilege = true;
const secCtx: CallSecurityContext = {
    username: 'testUser',
    clientId: 'testClient',
    platformRoleIds: ['role1', 'role2'],
    accessToken: 'mockToken',
};

describe("getAllParticipants", () => {
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
     * _calculateNdcAmount()
     * */
    

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

});
