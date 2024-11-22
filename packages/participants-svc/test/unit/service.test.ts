import { Service } from "../../src/application/service"; // Assuming the file is named service.ts
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { IAuditClient } from "@mojaloop/auditing-bc-public-types-lib";
import { IAuthorizationClient } from "@mojaloop/security-bc-public-types-lib";
import { IMetrics } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { IMessageProducer, IMessageConsumer } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { IParticipantsRepository } from "../../src/domain/repo_interfaces"; // Replace with actual path
import { IAccountsBalancesAdapter } from "../../src/domain/iparticipant_account_balances_adapter"; // Replace with actual path
import { ConfigurationClient, IConfigProvider } from "@mojaloop/platform-configuration-bc-client-lib"; // Replace with actual path
import { ConfigParameterTypes, ConfigParameter } from "@mojaloop/platform-configuration-bc-public-types-lib";

jest.mock("../../src/application/configset", () => ({
    GetParticipantsConfigs: jest.fn(), // Create a mock function
}));

jest.mock("@mojaloop/security-bc-client-lib", () => ({
    LoginHelper: jest.fn().mockImplementation(() => ({
        setAppCredentials: jest.fn().mockResolvedValue(undefined),
    })),
    TokenHelper: jest.fn().mockImplementation(() => ({
        init: jest.fn().mockResolvedValue(undefined),
    }))
}));

import { GetParticipantsConfigs } from "../../src/application/configset";
import { TokenHelper } from "@mojaloop/security-bc-client-lib";

describe("Service Unit Tests", () => {
    let mockLogger: jest.Mocked<ILogger>;
    let mockAuditClient: jest.Mocked<IAuditClient>;
    let mockAuthorizationClient: jest.Mocked<IAuthorizationClient>;
    let mockRepoPart: jest.Mocked<IParticipantsRepository>;
    let mockAccAndBalAdapter: jest.Mocked<IAccountsBalancesAdapter>;
    let mockMessageProducer: jest.Mocked<IMessageProducer>;
    let mockMessageConsumer: jest.Mocked<IMessageConsumer>;
    let mockConfigProvider: jest.Mocked<IConfigProvider>;
    let mockConfigClient: jest.Mocked<ConfigurationClient>;
    let mockMetrics: jest.Mocked<IMetrics>;

    beforeEach(() => {
        // Mock ILogger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            createChild: jest.fn().mockReturnThis(),
            destroy: jest.fn(),
            isInfoEnabled: jest.fn(),
        } as unknown as jest.Mocked<ILogger>;

        // Mock IAuditClient
        mockAuditClient = {
            logAuditMessage: jest.fn(),
            audit: jest.fn()
        } as unknown as jest.Mocked<IAuditClient>;

        // Mock IAuthorizationClient
        mockAuthorizationClient = {
            authorize: jest.fn().mockResolvedValue(true),
        } as unknown as jest.Mocked<IAuthorizationClient>;

        // Mock IParticipantsRepository
        mockRepoPart = {
            init: jest.fn(),
            fetchWhereId: jest.fn(),
            create: jest.fn(),
            store: jest.fn()
        } as unknown as jest.Mocked<IParticipantsRepository>;

        // Mock IAccountsBalancesAdapter
        mockAccAndBalAdapter = {
            init: jest.fn(),
            createAccount: jest.fn()
        } as unknown as jest.Mocked<IAccountsBalancesAdapter>;

        // Mock IMessageProducer
        mockMessageProducer = {
            disconnect: jest.fn(),
            connect: jest.fn(),
            destroy: jest.fn(),
            send: jest.fn(),
        } as unknown as jest.Mocked<IMessageProducer>;

        // Mock IMessageConsumer
        mockMessageConsumer = {
            setCallbackFn: jest.fn(),
            setBatchCallbackFn: jest.fn(),
            setFilteringFn: jest.fn(),
            setTopics: jest.fn(),
            setBatchSize: jest.fn(),
            destroy: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn(),
            start: jest.fn(),
            startAndWaitForRebalance: jest.fn(),
            stop: jest.fn(),
        } as unknown as jest.Mocked<IMessageConsumer>;

        // Mock IMetrics
        mockMetrics = {
            getHistogram: jest.fn(),
            getSummary: jest.fn(),
            getGauge: jest.fn(),
            getCounter: jest.fn(),
        } as unknown as jest.Mocked<IMetrics>;

        // Mock ConfigurationClient
        mockConfigClient = {
            init: jest.fn().mockResolvedValue(undefined),
            destroy: jest.fn(),
            fetch: jest.fn().mockResolvedValue(undefined),
            bootstrap: jest.fn().mockResolvedValue(true),
            setChangeHandlerFunction: jest.fn(),
            boundedContextName: "participants-bc",
            bcConfigs: {} as any,
            globalConfigs: {
                getCurrencies: jest.fn().mockReturnValue([
                    { code: "USD", name: "US Dollar" },
                    { code: "EUR", name: "Euro" },
                ]),
            },
        } as unknown as jest.Mocked<ConfigurationClient>;

        // Mock IConfigProvider
        mockConfigProvider = {
            init: jest.fn().mockResolvedValue(true),
            destroy: jest.fn(),
            boostrapBoundedContextConfigs: jest.fn().mockResolvedValue(true),
            fetchBoundedContextConfigs: jest.fn().mockResolvedValue(null),
            fetchGlobalConfigs: jest.fn().mockResolvedValue({
                schemaVersion: "1.0",
                iterationNumber: 1,
                parameters: [
                    { name: "MAKER_CHECKER_ENABLED", type: ConfigParameterTypes.BOOL, defaultValue: true, description: "Test flag", currentValue: true } as ConfigParameter,
                ],
                featureFlags: [],
                secrets: [],
            }),
            setConfigChangeHandler: jest.fn(),
        } as unknown as jest.Mocked<IConfigProvider>;
    });

    it("should start the service successfully", async () => {
        (GetParticipantsConfigs as jest.Mock).mockReturnValue(mockConfigClient);

        mockRepoPart.create.mockResolvedValueOnce(true);
        mockAccAndBalAdapter.createAccount.mockResolvedValueOnce("acc-001");
        mockRepoPart.store.mockResolvedValueOnce(true);
        mockLogger.isInfoEnabled.mockResolvedValueOnce(true as never);

        await Service.start(
            mockLogger,
            mockAuditClient,
            mockAuthorizationClient,
            mockRepoPart,
            mockAccAndBalAdapter,
            mockMessageProducer,
            mockConfigProvider,
            mockMetrics,
            mockMessageConsumer
        );

        expect(TokenHelper).toHaveBeenCalledWith(
            "http://localhost:3201/.well-known/jwks.json",
            mockLogger,
            "mojaloop.vnext.dev.default_issuer",
            "mojaloop.vnext.dev.default_audience",
            expect.anything()
        );
    });

    it("should stop the service successfully", async () => {
        await Service.stop();

        
        expect(true)
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});
