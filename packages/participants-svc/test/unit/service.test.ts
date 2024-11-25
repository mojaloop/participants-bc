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
    })),
    AuthenticatedHttpRequester: jest.fn().mockImplementation(() => ({
        setAppCredentials: jest.fn().mockResolvedValue(undefined),
    })),
    AuthorizationClient: jest.fn().mockImplementation(() => ({
        init: jest.fn(),
        addPrivilegesArray: jest.fn(),
        bootstrap: jest.fn(),
        fetch: jest.fn()
    })),
}));

jest.mock("@mojaloop/auditing-bc-client-lib", () => {
    const createRsaPrivateKeyFileSyncMock = jest.fn(); // Mock static method

    const LocalAuditClientCryptoProviderMock = jest.fn().mockImplementation(() => ({
        // Mock instance methods
        someInstanceMethod: jest.fn(),
    }));

    return {
        LocalAuditClientCryptoProvider: Object.assign(LocalAuditClientCryptoProviderMock, {
            createRsaPrivateKeyFileSync: createRsaPrivateKeyFileSyncMock,
        }),
        KafkaAuditClientDispatcher: jest.fn().mockImplementation(() => ({
            init: jest.fn(),
            destroy: jest.fn(),
            dispatch: jest.fn(),
        })),
        AuditClient: jest.fn().mockImplementation(() => ({
            logAuditMessage: jest.fn(),
            audit: jest.fn(),
            init: jest.fn()
        })),
    };
});

jest.mock("@mojaloop/platform-shared-lib-nodejs-kafka-client-lib", () => ({
    MLKafkaJsonConsumer: jest.fn().mockImplementation(() => ({
        setTopics: jest.fn(),
        setCallbackFn: jest.fn(),
        connect: jest.fn(),
        startAndWaitForRebalance: jest.fn()
    })),
    MLKafkaJsonProducer: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue("mock-connected"),
    }))
}));

jest.mock("../../src/implementations/grpc_acc_bal_adapter", () => ({
    GrpcAccountsAndBalancesAdapter: jest.fn().mockImplementation(() => ({
        init: jest.fn().mockResolvedValue(undefined),
        createAccount: jest.fn().mockResolvedValueOnce("acc-001")
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


    let mockExit: jest.SpyInstance;
    let mockConsoleInfo: jest.SpyInstance;
    let mockConsoleLog: jest.SpyInstance;
    let mockSetTimeout: jest.SpyInstance;
    const originalProcess = process;

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
            setLogLevel: jest.fn(),
        } as unknown as jest.Mocked<ILogger>;

        // Mock IAuditClient
        mockAuditClient = {
            logAuditMessage: jest.fn(),
            audit: jest.fn(),
            destroy: jest.fn(),
        } as unknown as jest.Mocked<IAuditClient>;

        // Mock IAuthorizationClient
        mockAuthorizationClient = {
            authorize: jest.fn().mockResolvedValue(true),
            destroy: jest.fn(),
        } as unknown as jest.Mocked<IAuthorizationClient>;

        // Mock IParticipantsRepository
        mockRepoPart = {
            init: jest.fn(),
            fetchWhereId: jest.fn(),
            create: jest.fn(),
            store: jest.fn(),
            destroy: jest.fn(),
        } as unknown as jest.Mocked<IParticipantsRepository>;

        // Mock IAccountsBalancesAdapter
        mockAccAndBalAdapter = {
            init: jest.fn(),
            createAccount: jest.fn(),
            destroy: jest.fn(),
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

    afterEach(() => {

        jest.clearAllMocks();

    });

    it("should start the service successfully", async () => {
        //Arrange & Act
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

        // Assert
        expect(TokenHelper).toHaveBeenCalledWith(
            "http://localhost:3201/.well-known/jwks.json",
            mockLogger,
            "mojaloop.vnext.dev.default_issuer",
            "mojaloop.vnext.dev.default_audience",
            expect.anything()
        );

        await Service.stop();
    });
    
    it("should initiate configProvider if not defined", async () => {
        //Arrange & Act
        
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
            undefined,
            mockMetrics,
            mockMessageConsumer
        );

        // Assert
        expect(TokenHelper).toHaveBeenCalledWith(
            "http://localhost:3201/.well-known/jwks.json",
            mockLogger,
            "mojaloop.vnext.dev.default_issuer",
            "mojaloop.vnext.dev.default_audience",
            expect.anything()
        );

        await Service.stop();
    });

    it("should initiate audit client if not defined", async () => {
        //Arrange & Act
        (GetParticipantsConfigs as jest.Mock).mockReturnValue(mockConfigClient);

        mockRepoPart.create.mockResolvedValueOnce(true);
        mockAccAndBalAdapter.createAccount.mockResolvedValueOnce("acc-001");
        mockRepoPart.store.mockResolvedValueOnce(true);
        mockLogger.isInfoEnabled.mockResolvedValueOnce(true as never);

        await Service.start(
            mockLogger,
            undefined,
            mockAuthorizationClient,
            mockRepoPart,
            mockAccAndBalAdapter,
            mockMessageProducer,
            mockConfigProvider,
            mockMetrics,
            mockMessageConsumer
        );

        // Assert
        expect(TokenHelper).toHaveBeenCalledWith(
            "http://localhost:3201/.well-known/jwks.json",
            mockLogger,
            "mojaloop.vnext.dev.default_issuer",
            "mojaloop.vnext.dev.default_audience",
            expect.anything()
        );

        await Service.stop();
    });

    it("should initiate authorization client if not defined", async () => {
        // Arrange & Act
        (GetParticipantsConfigs as jest.Mock).mockReturnValue(mockConfigClient);

        mockRepoPart.create.mockResolvedValueOnce(true);
        mockAccAndBalAdapter.createAccount.mockResolvedValueOnce("acc-001");
        mockRepoPart.store.mockResolvedValueOnce(true);
        mockLogger.isInfoEnabled.mockResolvedValueOnce(true as never);

        await Service.start(
            mockLogger,
            mockAuditClient,
            undefined,
            mockRepoPart,
            mockAccAndBalAdapter,
            mockMessageProducer,
            mockConfigProvider,
            mockMetrics,
            mockMessageConsumer
        );

        //Assert
        expect(TokenHelper).toHaveBeenCalledWith(
            "http://localhost:3201/.well-known/jwks.json",
            mockLogger,
            "mojaloop.vnext.dev.default_issuer",
            "mojaloop.vnext.dev.default_audience",
            expect.anything()
        );

        await Service.stop();
    });

    it("should initiate GrpcAccountsAndBalancesAdapter if not defined", async () => {
        //Arrange & Act
        (GetParticipantsConfigs as jest.Mock).mockReturnValue(mockConfigClient);

        mockRepoPart.create.mockResolvedValueOnce(true);

        mockRepoPart.store.mockResolvedValueOnce(true);
        mockLogger.isInfoEnabled.mockResolvedValueOnce(true as never);

        await Service.start(
            mockLogger,
            mockAuditClient,
            mockAuthorizationClient,
            mockRepoPart,
            undefined,
            mockMessageProducer,
            mockConfigProvider,
            mockMetrics,
            mockMessageConsumer
        );

        //Assert
        expect(TokenHelper).toHaveBeenCalledWith(
            "http://localhost:3201/.well-known/jwks.json",
            mockLogger,
            "mojaloop.vnext.dev.default_issuer",
            "mojaloop.vnext.dev.default_audience",
            expect.anything()
        );

        await Service.stop();
    });

    it("should setup message producer if it was not defined", async () => {
        //Arrange & Act
        (GetParticipantsConfigs as jest.Mock).mockReturnValue(mockConfigClient);

        mockRepoPart.create.mockResolvedValueOnce(true);

        mockRepoPart.store.mockResolvedValueOnce(true);
        mockLogger.isInfoEnabled.mockResolvedValueOnce(true as never);

        await Service.start(
            mockLogger,
            mockAuditClient,
            mockAuthorizationClient,
            mockRepoPart,
            mockAccAndBalAdapter,
            undefined,
            mockConfigProvider,
            mockMetrics,
            mockMessageConsumer
        );

        //Assert
        expect(TokenHelper).toHaveBeenCalledWith(
            "http://localhost:3201/.well-known/jwks.json",
            mockLogger,
            "mojaloop.vnext.dev.default_issuer",
            "mojaloop.vnext.dev.default_audience",
            expect.anything()
        );

        await Service.stop();
    });


    it("should setup PrometheusMetrics if metrics were not defined", async () => {
        //Arrange & Act
        (GetParticipantsConfigs as jest.Mock).mockReturnValue(mockConfigClient);

        mockRepoPart.create.mockResolvedValueOnce(true);

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
            undefined,
            mockMessageConsumer
        );

        //Assert
        expect(TokenHelper).toHaveBeenCalledWith(
            "http://localhost:3201/.well-known/jwks.json",
            mockLogger,
            "mojaloop.vnext.dev.default_issuer",
            "mojaloop.vnext.dev.default_audience",
            expect.anything()
        );

        await Service.stop();
    });

    it("should setup MLKafkaJsonConsumer if it was not defined", async () => {
        //Arrange & Act
        (GetParticipantsConfigs as jest.Mock).mockReturnValue(mockConfigClient);

        mockRepoPart.create.mockResolvedValueOnce(true);

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
            undefined
        );

        //Assert
        expect(TokenHelper).toHaveBeenCalledWith(
            "http://localhost:3201/.well-known/jwks.json",
            mockLogger,
            "mojaloop.vnext.dev.default_issuer",
            "mojaloop.vnext.dev.default_audience",
            expect.anything()
        );

        await Service.stop();
    });

    it("should stop the service successfully", async () => {
        //Arrange & Act
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

        const mockAuditClientSpy = jest.spyOn(mockAuditClient, 'destroy');
        const mockRepoPartSpy = jest.spyOn(mockRepoPart, 'destroy');
        const mockAccAndBalAdapterSpy = jest.spyOn(mockAccAndBalAdapter, 'destroy');
        const mockMessageProducerSpy = jest.spyOn(mockMessageProducer, 'destroy');
        const mockConfigClientSpy = jest.spyOn(mockConfigClient, 'destroy');
        const mockMessageConsumerSpy = jest.spyOn(mockMessageConsumer, 'destroy');
        

        await Service.stop();

        expect(mockAuditClientSpy).toHaveBeenCalled();
        expect(mockRepoPartSpy).toHaveBeenCalled();
        expect(mockAccAndBalAdapterSpy).toHaveBeenCalled();
        expect(mockMessageProducerSpy).toHaveBeenCalled();
        expect(mockConfigClientSpy).toHaveBeenCalled();
        expect(mockMessageConsumerSpy).toHaveBeenCalled();
    });

    it("should handle SIGINT signal correctly", async () => {
        // Arrange & Act
        mockExit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      
        mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation(() => { });
        mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => { });

       
        mockSetTimeout = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
            return undefined as any;
        });

        
        jest.spyOn(Service, 'stop').mockResolvedValue();
       
        const sigintHandler = process.listeners('SIGINT')[0] as (signal: NodeJS.Signals) => Promise<void>;

       
        await sigintHandler('SIGINT');

        // Assert
        expect(mockConsoleInfo).toHaveBeenCalledWith('Service - SIGINT received - cleaning up...');
        expect(Service.stop).toHaveBeenCalled();
        expect(mockSetTimeout).toHaveBeenCalled();
        expect(mockExit).toHaveBeenCalled();

        mockExit.mockRestore();
        mockConsoleInfo.mockRestore();
        mockConsoleLog.mockRestore();
        mockSetTimeout.mockRestore();
    });

});


