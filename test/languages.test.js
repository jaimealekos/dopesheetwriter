// Pruebas de core/languages.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isEnglish,
  languageCodeFromName,
  languageNameFromCode,
  targetLanguageLabel,
  translationTarget,
} from '../core/languages.js';

test('languageNameFromCode: reconoce códigos con cualquier capitalización', () => {
  assert.equal(languageNameFromCode('es'), 'Spanish');
  assert.equal(languageNameFromCode('EN'), 'English');
});

test('languageNameFromCode: desconocido, vacío o no texto devuelve null', () => {
  assert.equal(languageNameFromCode('xx'), null);
  assert.equal(languageNameFromCode(''), null);
  assert.equal(languageNameFromCode(null), null);
  assert.equal(languageNameFromCode('constructor'), null);
});

test('languageCodeFromName: código, nombre inglés y nombre castellano', () => {
  assert.equal(languageCodeFromName('Francés'), 'fr');
  assert.equal(languageCodeFromName('english'), 'en');
  assert.equal(languageCodeFromName('EU'), 'eu');
  assert.equal(languageCodeFromName(' FR '), 'fr');
  assert.equal(languageCodeFromName('Castellano'), 'es');
  assert.equal(languageCodeFromName('Euskera'), 'eu');
  assert.equal(languageCodeFromName('Vasco'), 'eu');
});

test('languageCodeFromName: desconocido, vacío o no texto devuelve null', () => {
  assert.equal(languageCodeFromName('Klingon'), null);
  assert.equal(languageCodeFromName(''), null);
  assert.equal(languageCodeFromName('   '), null);
  assert.equal(languageCodeFromName(42), null);
  assert.equal(languageCodeFromName(null), null);
  assert.equal(languageCodeFromName('constructor'), null);
});

test('isEnglish: acepta las variantes del inglés', () => {
  for (const value of ['English', ' english ', 'inglés', 'Ingles', 'en']) {
    assert.equal(isEnglish(value), true, value);
  }
});

test('isEnglish: otros idiomas, vacío o no texto son false', () => {
  for (const value of ['Spanish', '', undefined]) {
    assert.equal(isEnglish(value), false, String(value));
  }
});

test('translationTarget: inglés va a español y el resto a inglés', () => {
  assert.equal(translationTarget('English'), 'es');
  assert.equal(translationTarget('Spanish'), 'en');
  assert.equal(translationTarget(''), 'en');
});

test('targetLanguageLabel: etiquetas de es y en; otro código es RangeError', () => {
  assert.equal(targetLanguageLabel('es'), 'Spanish');
  assert.equal(targetLanguageLabel('en'), 'English');
  assert.throws(() => targetLanguageLabel('fr'), RangeError);
});
