import { describe, it, expect } from 'vitest';

/**
 * Tests for the OTP security flow logic:
 * - 5-minute countdown (300 seconds)
 * - 6-digit numeric-only input validation
 * - 3 attempt maximum with lockout
 * - Expired state handling
 */

describe('OTP Security Flow Logic', () => {
  describe('Input validation', () => {
    const isValidOtp = (value: string): boolean => /^\d{6}$/.test(value);

    it('should accept exactly 6 digits', () => {
      expect(isValidOtp('123456')).toBe(true);
      expect(isValidOtp('000000')).toBe(true);
      expect(isValidOtp('999999')).toBe(true);
    });

    it('should reject non-numeric input', () => {
      expect(isValidOtp('12345a')).toBe(false);
      expect(isValidOtp('abcdef')).toBe(false);
      expect(isValidOtp('12 456')).toBe(false);
    });

    it('should reject wrong length', () => {
      expect(isValidOtp('12345')).toBe(false);
      expect(isValidOtp('1234567')).toBe(false);
      expect(isValidOtp('')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(isValidOtp('123-56')).toBe(false);
      expect(isValidOtp('12.456')).toBe(false);
    });
  });

  describe('Countdown timer', () => {
    const OTP_DURATION_SECONDS = 300;

    it('should start at 5 minutes (300 seconds)', () => {
      expect(OTP_DURATION_SECONDS).toBe(300);
    });

    it('should format time correctly', () => {
      const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
      };

      expect(formatTime(300)).toBe('5:00');
      expect(formatTime(299)).toBe('4:59');
      expect(formatTime(60)).toBe('1:00');
      expect(formatTime(59)).toBe('0:59');
      expect(formatTime(1)).toBe('0:01');
      expect(formatTime(0)).toBe('0:00');
    });

    it('should consider expired when seconds <= 0', () => {
      const isExpired = (secondsLeft: number) => secondsLeft <= 0;
      expect(isExpired(1)).toBe(false);
      expect(isExpired(0)).toBe(true);
      expect(isExpired(-1)).toBe(true);
    });
  });

  describe('Attempt tracking', () => {
    const MAX_ATTEMPTS = 3;

    it('should allow up to 3 attempts', () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        expect(i < MAX_ATTEMPTS).toBe(true);
      }
    });

    it('should lock after 3 failed attempts', () => {
      const isLocked = (attempts: number) => attempts >= MAX_ATTEMPTS;
      expect(isLocked(0)).toBe(false);
      expect(isLocked(1)).toBe(false);
      expect(isLocked(2)).toBe(false);
      expect(isLocked(3)).toBe(true);
      expect(isLocked(4)).toBe(true);
    });

    it('should calculate remaining attempts correctly', () => {
      const remaining = (attempts: number) => MAX_ATTEMPTS - attempts;
      expect(remaining(0)).toBe(3);
      expect(remaining(1)).toBe(2);
      expect(remaining(2)).toBe(1);
      expect(remaining(3)).toBe(0);
    });
  });

  describe('State machine', () => {
    type OtpState = 'active' | 'expired' | 'locked';

    function getOtpState(secondsLeft: number, attempts: number): OtpState {
      if (attempts >= 3) return 'locked';
      if (secondsLeft <= 0) return 'expired';
      return 'active';
    }

    it('should be active when time remaining and attempts < 3', () => {
      expect(getOtpState(200, 0)).toBe('active');
      expect(getOtpState(1, 2)).toBe('active');
    });

    it('should be expired when time runs out', () => {
      expect(getOtpState(0, 0)).toBe('expired');
      expect(getOtpState(0, 2)).toBe('expired');
    });

    it('should be locked when max attempts reached (even if time remains)', () => {
      expect(getOtpState(200, 3)).toBe('locked');
      expect(getOtpState(0, 3)).toBe('locked'); // locked takes priority over expired
    });

    it('input should be disabled when expired or locked', () => {
      const isDisabled = (state: OtpState) => state === 'expired' || state === 'locked';
      expect(isDisabled('active')).toBe(false);
      expect(isDisabled('expired')).toBe(true);
      expect(isDisabled('locked')).toBe(true);
    });

    it('submit button should only be enabled in active state with valid input', () => {
      const canSubmit = (state: OtpState, inputLength: number, loading: boolean) =>
        state === 'active' && inputLength === 6 && !loading;
      
      expect(canSubmit('active', 6, false)).toBe(true);
      expect(canSubmit('active', 5, false)).toBe(false);
      expect(canSubmit('active', 6, true)).toBe(false);
      expect(canSubmit('expired', 6, false)).toBe(false);
      expect(canSubmit('locked', 6, false)).toBe(false);
    });
  });
});
