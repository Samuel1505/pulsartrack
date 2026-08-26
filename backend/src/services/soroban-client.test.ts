import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callReadOnly, toAddressScVal, toU64ScVal, getServer } from './soroban-client';

// Mock stellar-sdk
const mockSimulateTransaction = vi.fn();
const mockGetAccount = vi.fn();

vi.mock('@stellar/stellar-sdk', () => {
  const actual = vi.importActual<any>('@stellar/stellar-sdk');
  return {
    ...actual,
    rpc: {
      Server: vi.fn().mockImplementation(() => ({
        simulateTransaction: mockSimulateTransaction,
        getAccount: mockGetAccount,
      })),
      Api: {
        isSimulationError: (sim: any) => sim?.error !== undefined && !sim?.result,
        isSimulationSuccess: (sim: any) => sim?.result !== undefined,
      },
    },
    Contract: vi.fn().mockImplementation(() => ({
      call: vi.fn().mockReturnValue('mock_op'),
    })),
    TransactionBuilder: Object.assign(
      vi.fn().mockImplementation(() => ({
        addOperation: vi.fn().mockReturnThis(),
        setTimeout: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnValue('mock_tx'),
      })),
      { fromXDR: vi.fn() },
    ),
    BASE_FEE: '100',
    scValToNative: vi.fn().mockReturnValue('decoded_value'),
    nativeToScVal: vi.fn().mockReturnValue('scval'),
    xdr: {},
    Address: vi.fn().mockImplementation(() => ({
      toScVal: vi.fn().mockReturnValue('address_scval'),
    })),
  };
});

vi.mock('../config/stellar', () => ({
  stellarConfig: {
    sorobanRpcUrl: 'https://soroban-rpc.testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2024',
  },
  STELLAR_REQUEST_TIMEOUT_MS: 30000,
  getHorizonServer: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAccount.mockResolvedValue({ accountId: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN' });
});

describe('soroban-client', () => {
  describe('callReadOnly', () => {
    it('returns decoded value on successful simulation', async () => {
      mockSimulateTransaction.mockResolvedValue({
        result: { retval: 'mock_retval' },
      });

      const result = await callReadOnly('CABC123...', 'get_balance');
      expect(result).toBe('decoded_value');
      expect(mockSimulateTransaction).toHaveBeenCalled();
    });

    it('throws on simulation error', async () => {
      mockSimulateTransaction.mockResolvedValue({ error: 'contract error' });

      await expect(callReadOnly('CABC123...', 'fail')).rejects.toThrow('Simulation error');
    });

    it('throws on missing result', async () => {
      mockSimulateTransaction.mockResolvedValue({});

      await expect(callReadOnly('CABC123...', 'unknown')).rejects.toThrow('no result');
    });

    it('throws on placeholder contract ID', async () => {
      await expect(callReadOnly('PLACEHOLDER', 'method')).rejects.toThrow('missing or a placeholder');
    });

    it('throws on empty contract ID', async () => {
      await expect(callReadOnly('', 'method')).rejects.toThrow('missing or a placeholder');
    });
  });

  describe('toAddressScVal', () => {
    it('creates an ScVal from an address', () => {
      const result = toAddressScVal('GABC123...');
      expect(result).toBe('address_scval');
    });
  });

  describe('toU64ScVal', () => {
    it('creates an ScVal from a number', () => {
      const result = toU64ScVal(42);
      expect(result).toBe('scval');
    });
  });
});
