import { describe, expect, it } from 'bun:test';
import { generateOrganizationCode } from '../../utils';

describe('generateOrganizationCode', () => {
  it('generate acronym from name with parentheses and suffix', () => {
    expect(
      generateOrganizationCode(
        'Balai Besar Perikanan Budidaya Air Tawar (BBPBAT) Sukabumi'
      )
    ).toBe('BBPBAT-Sukabumi');
  });

  it('generate acronym from name without parentheses', () => {
    expect(generateOrganizationCode('UPT Puskesmas')).toBe('UP');
  });

  it('generate acronym from single word name', () => {
    expect(generateOrganizationCode('Kantor')).toBe('K');
  });

  it('generate acronym from two-word name', () => {
    expect(generateOrganizationCode('Kantor Kelurahan')).toBe('KK');
  });

  it('handle extra whitespace', () => {
    expect(
      generateOrganizationCode(
        'Balai Besar Perikanan Budidaya Air Tawar (BBPBAT) Sukabumi'
      )
    ).toBe('BBPBAT-Sukabumi');
  });

  it('handle lowercase input', () => {
    expect(
      generateOrganizationCode(
        'Balai Besar Perikanan Budidaya Air Tawar (BBPBAT) Sukabumi'
      )
    ).toBe('BBPBAT-Sukabumi');
  });
});
