import { GrpcAccountsAndBalancesAdapter } from "../../src/implementations/grpc_acc_bal_adapter";
import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import { LoginHelper } from "@mojaloop/security-bc-client-lib";
import { AccountsAndBalancesGrpcClient } from "@mojaloop/accounts-and-balances-bc-grpc-client-lib";
import { AccountsAndBalancesAccount } from "@mojaloop/accounts-and-balances-bc-public-types-lib";

jest.mock("@mojaloop/accounts-and-balances-bc-grpc-client-lib");

describe("GrpcAccountsAndBalancesAdapter - createJournalEntry", () => {
    let adapter: GrpcAccountsAndBalancesAdapter;
    let mockClient: jest.Mocked<AccountsAndBalancesGrpcClient>;
    let mockLogger: ILogger;
    let mockLoginHelper: LoginHelper;

    beforeEach(() => {
        mockLogger = {
            createChild: jest.fn().mockReturnValue({
                info: jest.fn(),
                error: jest.fn(),
            }),
        } as unknown as ILogger;

        mockLoginHelper = {
            setToken: jest.fn(),
            setUserCredentials: jest.fn(),
            setAppCredentials: jest.fn(),
        } as unknown as LoginHelper;

        mockClient = {
            createAccounts: jest.fn(),
            createJournalEntries: jest.fn(),
            init: jest.fn(),
            getAccountsByIds: jest.fn()
        } as unknown as jest.Mocked<AccountsAndBalancesGrpcClient>;

        (AccountsAndBalancesGrpcClient as jest.Mock).mockImplementation(() => mockClient);

        adapter = new GrpcAccountsAndBalancesAdapter("grpc-url", mockLoginHelper, mockLogger);
    });

    it("should return the created journal entry ID when successful", async () => {
        // Arrange
        mockClient.createJournalEntries.mockResolvedValue({
            grpcIdArray: [{ grpcId: "mockJournalEntryId" }],
        });

        // Assert
        await adapter.init();
        const journalEntryId = await adapter.createJournalEntry(
            "reqId", "ownerId", "USD", "100.00", false, "debitedId", "creditedId"
        );

        // Assertions
        expect(journalEntryId).toBe("mockJournalEntryId");
        expect(mockClient.createJournalEntries).toHaveBeenCalledWith({
            entriesToCreate: [
                {
                    requestedId: "reqId",
                    amount: "100.00",
                    pending: false,
                    ownerId: "ownerId",
                    currencyCode: "USD",
                    debitedAccountId: "debitedId",
                    creditedAccountId: "creditedId",
                },
            ],
        });
    });

    it("should throw an error when createJournalEntries fails", async () => {
        // Arrange
        mockClient.createJournalEntries.mockRejectedValue(new Error("Remote service error"));

        await adapter.init();

        // Assert
        await expect(
            adapter.createJournalEntry(
                "reqId", "ownerId", "USD", "100.00", false, "debitedId", "creditedId"
            )
        ).rejects.toThrow("Could not create journalEntry in remote system: Error: Remote service error");

        expect(mockClient.createJournalEntries).toHaveBeenCalledTimes(1);
    });

    it("should return an array of accounts when accounts are found", async () => {
        // Mock the response of getAccountsByIds
        const mockAccounts: AccountsAndBalancesAccount[] = [
            {
                id: "acc1",
                ownerId: "owner1",
                state: "ACTIVE",
                type: "FEE",
                currencyCode: "USD",
                postedDebitBalance: "500.00",
                pendingDebitBalance: "50.00",
                postedCreditBalance: "700.00",
                pendingCreditBalance: "100.00",
                balance: "150.00",
                timestampLastJournalEntry: 1634567890123,
            },
            {
                id: "acc2",
                ownerId: "owner2",
                state: "INACTIVE",
                type: "SETTLEMENT",
                currencyCode: "EUR",
                postedDebitBalance: "200.00",
                pendingDebitBalance: null,
                postedCreditBalance: "400.00",
                pendingCreditBalance: "10.00",
                balance: "210.00",
                timestampLastJournalEntry: 1634567890123,
            },
        ];
        mockClient.getAccountsByIds.mockResolvedValue(mockAccounts);

        // Call the method
        await adapter.init();
        const accounts = await adapter.getAccounts(["acc1", "acc2"]);

        // Assertions
        expect(accounts).toEqual(mockAccounts);
        expect(mockClient.getAccountsByIds).toHaveBeenCalledWith(["acc1", "acc2"]);
        expect(mockClient.getAccountsByIds).toHaveBeenCalledTimes(1);
    });

    it("should return an empty array when no accounts are found", async () => {
        // Arrange
        mockClient.getAccountsByIds.mockResolvedValue([]);

        // Act
        await adapter.init();
        const accounts = await adapter.getAccounts(["nonexistentId"]);

        // Assertions
        expect(accounts).toEqual([]);
        expect(mockClient.getAccountsByIds).toHaveBeenCalledWith(["nonexistentId"]);
        expect(mockClient.getAccountsByIds).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if getAccountsByIds fails", async () => {
        // Arrange
        mockClient.getAccountsByIds.mockRejectedValue(new Error("Service error"));

        // Act
        await adapter.init();
        await expect(adapter.getAccounts(["acc1"])).rejects.toThrow("Service error");

        // Assert
        expect(mockClient.getAccountsByIds).toHaveBeenCalledWith(["acc1"]);
        expect(mockClient.getAccountsByIds).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if createAccounts fails with a generic error", async () => {
        // Arrange
        const errorMessage = "Generic service error";
        mockClient.createAccounts.mockRejectedValue(new Error(errorMessage));

        // Act
        await adapter.init();

        //Asserts
        await expect(
            adapter.createAccount("req1", "owner1", "FEE", "USD")
        ).rejects.toThrow(`Could not create account in remote system: Error: ${errorMessage}`);

        expect(mockClient.createAccounts).toHaveBeenCalledWith({
            accountsToCreate: [
                {
                    requestedId: "req1",
                    type: "FEE",
                    ownerId: "owner1",
                    currencyCode: "USD",
                },
            ],
        });
        expect(mockClient.createAccounts).toHaveBeenCalledTimes(1);
    });

    it("should throw an UnauthorizedError if createAccounts fails with an UnauthorizedError", async () => {
        // Arrange
        const unauthorizedError = new Error("Unauthorized access");
        Object.defineProperty(unauthorizedError, "constructor", {
            value: { name: "UnauthorizedError" },
        });

        mockClient.createAccounts.mockRejectedValue(unauthorizedError);

        // Act
        await adapter.init();

        // Asserts
        await expect(
            adapter.createAccount("req1", "owner1", "FEE", "USD")
        ).rejects.toThrow("Unauthorized access");

        expect(mockClient.createAccounts).toHaveBeenCalledWith({
            accountsToCreate: [
                {
                    requestedId: "req1",
                    type: "FEE",
                    ownerId: "owner1",
                    currencyCode: "USD",
                },
            ],
        });
        expect(mockClient.createAccounts).toHaveBeenCalledTimes(1);
    });
});

