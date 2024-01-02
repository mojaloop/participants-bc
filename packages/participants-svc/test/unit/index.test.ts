// index.test.ts
import { Service } from '../../src/application/service';

jest.mock('../../src/application/service', () => ({
  Service: {
    start: jest.fn(),
    stop: jest.fn(),
  },
}));

describe('Index', () => {

    beforeAll(()=> {
        (Service.start as jest.Mock).mockImplementation(() => Promise.resolve());
    })

  beforeEach(() => {
    // Clear the mock calls before each test
    jest.clearAllMocks();
  });

  test('should start the service', async () => {
    // Act
    await import('../../src/application/index');

    // Assert
    expect(Service.start).toHaveBeenCalled();
  });

});
