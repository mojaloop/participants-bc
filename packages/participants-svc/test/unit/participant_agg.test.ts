import { ParticipantAggregate } from "../../src/domain/participant_agg";
import { ConsoleLogger, ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { IConfigurationClient } from "@mojaloop/platform-configuration-bc-public-types-lib";
import { IParticipantsRepository } from "../../src/domain/repo_interfaces";
import { IAccountsBalancesAdapter } from "../../src/domain/iparticipant_account_balances_adapter";
import { IAuditClient } from "@mojaloop/auditing-bc-public-types-lib";
import { IAuthorizationClient } from "@mojaloop/security-bc-public-types-lib";
import { IMessageProducer } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { IMetrics, IHistogram, MetricsMock } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { AccountsBalancesAdapterMock, AuditClientMock, AuthorizationClientMock, MemoryConfigClientMock, MemoryMessageProducer, ParticipantsRepoMock, TokenHelperMock } from "@mojaloop/participants-bc-shared-mocks-lib";

// Mocks
const mockLogger: ILogger = {
    createChild: jest.fn().mockReturnThis(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
} as unknown as ILogger;

const mockConfigClient: IConfigurationClient = {
    boundedContextName: 'mockContext',
    bcConfigs: {} as any,
    globalConfigs: {
        getCurrencies: jest.fn().mockReturnValue(['USD', 'EUR']),
    } as any,
    init: jest.fn(),
    destroy: jest.fn(),
    fetch: jest.fn(),
    bootstrap: jest.fn().mockResolvedValue(true),
    setChangeHandlerFunction: jest.fn(),
} as unknown as IConfigurationClient;

const mockRepo: IParticipantsRepository = {
    init: jest.fn(),
    fetchWhereId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(true),
    store: jest.fn().mockResolvedValue(true),
    fetchAll: jest.fn().mockResolvedValue([])
} as unknown as IParticipantsRepository;

const mockAccBal: IAccountsBalancesAdapter = {
    init: jest.fn(),
    createAccount: jest.fn().mockResolvedValue("new-account-id"),
} as unknown as IAccountsBalancesAdapter;

const mockAuditClient: IAuditClient = {
    audit: jest.fn(),
} as unknown as IAuditClient;

const mockAuthorizationClient: IAuthorizationClient = {} as unknown as IAuthorizationClient;

const mockMessageProducer: IMessageProducer = {} as unknown as IMessageProducer;

const mockMetrics: IMetrics = {
    getHistogram: jest.fn().mockReturnValue({
        observe: jest.fn(),
    } as unknown as IHistogram),
} as unknown as IMetrics;

describe("ParticipantAggregate", () => {
    let participantAggregate: ParticipantAggregate;

    beforeEach(() => {
        participantAggregate = new ParticipantAggregate(
            mockConfigClient,
            mockRepo,
            mockAccBal,
            mockAuditClient,
            mockAuthorizationClient,
            mockMessageProducer,
            mockMetrics,
            mockLogger
        );
    });

    test("should initialize correctly and bootstrap the hub participant", async () => {
        await participantAggregate.init();

        // Verifying repository initialization
        expect(mockRepo.init).toHaveBeenCalled();

        // Verifying account balance initialization
        expect(mockAccBal.init).toHaveBeenCalled();

        // Verifying hub participant fetch
        expect(mockRepo.fetchWhereId).toHaveBeenCalledWith("hub");

        // Verifying hub participant creation
        expect(mockRepo.create).toHaveBeenCalled();

        // Verifying account creation
        expect(mockAccBal.createAccount).toHaveBeenCalled();

        // Verifying audit logging
        expect(mockAuditClient.audit).toHaveBeenCalled;
        expect(mockAuditClient.audit).toHaveBeenCalledWith(
            "PARTICIPANT_CREATED",
            true,
            expect.anything(),
            expect.anything()
        );
    });

    test("should throw an error if hub participant is not of type HUB", async () => {
        (mockRepo.fetchWhereId as jest.Mock).mockResolvedValueOnce({
            id: "hub",
            type: "NON_HUB",
        });

        await expect(participantAggregate.init()).rejects.toThrow(
            "Hub participant record is not of type HUB"
        );
    });

    test("should handle errors during bootstrap", async () => {
        (mockAccBal.createAccount as jest.Mock).mockRejectedValueOnce(
            new Error("Account creation failed")
        );

        await expect(participantAggregate.init()).rejects.toThrow(
            "'HUB' account 'HUB_MULTILATERAL_SETTLEMENT' failed upstream."
        );

        // Ensure logger captures the error
        expect(mockLogger.error).toHaveBeenCalledWith(expect.any(Error));
    });

    
});
