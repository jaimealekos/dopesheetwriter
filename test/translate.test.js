// Pruebas de main/translate.js con fetch falso. Sin red.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { splitForTranslation, translateText } from '../main/translate.js';

// Respuesta de google con un único segmento.
function googleResponse(text) {
  return [[[text, 'original', null, null, 1]], null, 'es'];
}

// Extrae el fragmento pedido de una URL de cualquiera de los dos proveedores.
function queryOf(url) {
  return new URL(url).searchParams.get('q');
}

test('splitForTranslation: conserva las líneas en blanco', () => {
  assert.deepEqual(splitForTranslation('a\n\nb', 450), ['a', '', 'b']);
});

test('splitForTranslation: parte una línea larga en fragmentos <= maxChars sin perder palabras', () => {
  const words = Array.from({ length: 200 }, (_value, index) => `palabra${index}`);
  const line = words.join(' ');

  const fragments = splitForTranslation(line, 450);

  assert.ok(fragments.length > 1);
  assert.ok(fragments.every((fragment) => fragment.length <= 450));
  assert.equal(fragments.join(' '), line);
});

test('splitForTranslation: una palabra de 600 caracteres se corta 450 + 150', () => {
  const word = 'a'.repeat(600);

  assert.deepEqual(splitForTranslation(word, 450), ['a'.repeat(450), 'a'.repeat(150)]);
});

test('translateText: traduce con google y pide la URL esperada', async () => {
  const urls = [];
  const fetchFn = async (url) => {
    urls.push(url);
    return { ok: true, status: 200, json: async () => googleResponse('Hello world') };
  };

  const result = await translateText('Hola mundo', { fetchFn });

  assert.deepEqual(result, { text: 'Hello world', provider: 'google' });
  assert.equal(urls.length, 1);
  assert.match(urls[0], /client=gtx/);
  assert.match(urls[0], /sl=auto/);
  assert.match(urls[0], /tl=en/);
  assert.match(urls[0], /q=Hola%20mundo/);
});

test('translateText: une varios segmentos de google', async () => {
  const fetchFn = async () => ({
    ok: true,
    status: 200,
    json: async () => [[['Hello. ', 'Hola. '], ['World', 'Mundo']]],
  });

  assert.deepEqual(await translateText('Hola. Mundo', { fetchFn }), {
    text: 'Hello. World',
    provider: 'google',
  });
});

test('translateText: si google falla, repite con mymemory y decodifica entidades', async () => {
  const urls = [];
  const fetchFn = async (url) => {
    urls.push(url);
    if (url.includes('translate.googleapis.com')) {
      throw new Error('sin conexión con google');
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ responseStatus: 200, responseData: { translatedText: 'It&#39;s' } }),
    };
  };

  const result = await translateText('Es', { fetchFn });

  assert.deepEqual(result, { text: "It's", provider: 'mymemory' });
  assert.match(urls[1], /langpair=Autodetect%7Cen/);
});

test('translateText: google no ok pasa a mymemory y, si ambos fallan, informa la causa', async () => {
  const googleFails = async (url) =>
    url.includes('translate.googleapis.com')
      ? { ok: false, status: 500, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ responseStatus: 200, responseData: { translatedText: 'Hello' } }) };

  assert.deepEqual(await translateText('Hola', { fetchFn: googleFails }), {
    text: 'Hello',
    provider: 'mymemory',
  });

  const bothFail = async (url) => {
    if (url.includes('translate.googleapis.com')) {
      throw new Error('fallo google');
    }
    throw new Error('fallo mymemory');
  };

  await assert.rejects(translateText('Hola', { fetchFn: bothFail }), (error) => {
    assert.match(error.message, /Translation service unavailable \(fallo mymemory\)\./);
    return true;
  });
});

test('translateText: una línea por petición y las líneas en blanco no piden nada', async () => {
  const requested = [];
  const fetchFn = async (url) => {
    const query = queryOf(url);
    requested.push(query);
    return { ok: true, status: 200, json: async () => googleResponse(query === 'Uno' ? 'One' : 'Two') };
  };

  const result = await translateText('Uno\n\nDos', { fetchFn });

  assert.deepEqual(result, { text: 'One\n\nTwo', provider: 'google' });
  assert.deepEqual(requested, ['Uno', 'Dos']);
});

test('translateText: las peticiones son secuenciales', async () => {
  let firstResolved = false;
  let overlapping = false;
  const fetchFn = async (url) => {
    const query = queryOf(url);
    if (query === 'Uno') {
      await new Promise((resolve) => setTimeout(resolve, 10));
      firstResolved = true;
    } else if (!firstResolved) {
      overlapping = true;
    }
    return { ok: true, status: 200, json: async () => googleResponse(query) };
  };

  await translateText('Uno\nDos', { fetchFn });

  assert.equal(overlapping, false);
});

test('translateText: un tiempo agotado se informa como timed out', async () => {
  const fetchFn = async () => {
    throw Object.assign(new Error('abortado'), { name: 'TimeoutError' });
  };

  await assert.rejects(
    translateText('Hola', { fetchFn, timeoutMs: 2500 }),
    (error) => {
      assert.match(error.message, /timed out after 2\.5 s/);
      return true;
    },
  );
});

test('translateText: texto vacío o demasiado largo fallan sin llamar a la red', async () => {
  let called = false;
  const fetchFn = async () => {
    called = true;
    return { ok: true, status: 200, json: async () => googleResponse('x') };
  };

  await assert.rejects(translateText('   ', { fetchFn }), {
    message: 'There is no text to translate.',
  });
  await assert.rejects(translateText('a'.repeat(5001), { fetchFn }), {
    message: 'The text is too long to translate (max 5000 characters).',
  });
  assert.equal(called, false);
});

test('splitForTranslation: una línea con signos corta tras el signo y no pasa de maxChars', () => {
  const signs = ['.', '?', '!', ';', ':'];
  const sentences = Array.from(
    { length: 8 },
    (_value, index) => `${index}${'a'.repeat(100)}${signs[index % signs.length]}`,
  );
  const text = sentences.join(' ');

  const fragments = splitForTranslation(text, 450);

  assert.ok(fragments.length > 1);
  assert.ok(fragments.every((fragment) => fragment.length <= 450));
  assert.ok(fragments.every((fragment) => signs.includes(fragment.at(-1))));
  assert.equal(fragments.join(' '), text);
});

test('translateText: una línea de más de 450 pide varios fragmentos y los une con un espacio', async () => {
  const sizes = [];
  const fetchFn = async (url) => {
    const query = queryOf(url);
    sizes.push(query.length);
    return { ok: true, status: 200, json: async () => googleResponse(`[${query.length}]`) };
  };

  const longLine = `${'a'.repeat(300)} ${'b'.repeat(300)}`;
  const result = await translateText(longLine, { fetchFn });

  assert.deepEqual(sizes, [300, 300]);
  assert.deepEqual(result, { text: '[300] [300]', provider: 'google' });
});

test('translateText: google con data[0] no array o sin texto pasa a mymemory', async () => {
  const myMemory = async (url) => {
    if (url.includes('translate.googleapis.com')) throw new Error('sin google');
    return {
      ok: true,
      status: 200,
      json: async () => ({ responseStatus: 200, responseData: { translatedText: 'Hello' } }),
    };
  };

  const notArray = async (url) =>
    url.includes('translate.googleapis.com')
      ? { ok: true, status: 200, json: async () => [null, null, 'es'] }
      : myMemory(url);

  assert.deepEqual(await translateText('Hola', { fetchFn: notArray }), {
    text: 'Hello',
    provider: 'mymemory',
  });

  const withoutText = async (url) =>
    url.includes('translate.googleapis.com')
      ? { ok: true, status: 200, json: async () => [[[null, null]]] }
      : myMemory(url);

  assert.deepEqual(await translateText('Hola', { fetchFn: withoutText }), {
    text: 'Hello',
    provider: 'mymemory',
  });
});

test('translateText: mymemory con estado distinto de 200 informa responseDetails', async () => {
  const fetchFn = async (url) => {
    if (url.includes('translate.googleapis.com')) throw new Error('sin google');
    return {
      ok: true,
      status: 200,
      json: async () => ({ responseStatus: 429, responseDetails: 'Quota exceeded' }),
    };
  };

  await assert.rejects(translateText('Hola', { fetchFn }), (error) => {
    assert.match(
      error.message,
      /Translation service unavailable \(Unexpected response format: Quota exceeded\.\)\./,
    );
    return true;
  });
});

test('translateText: mymemory decodifica &#39; &quot; &amp; &lt; &gt;', async () => {
  const fetchFn = async (url) => {
    if (url.includes('translate.googleapis.com')) throw new Error('sin google');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        responseStatus: 200,
        responseData: { translatedText: 'It&#39;s &quot;ok&quot; &amp; &lt;tag&gt;' },
      }),
    };
  };

  assert.deepEqual(await translateText('Es', { fetchFn }), {
    text: 'It\'s "ok" & <tag>',
    provider: 'mymemory',
  });
});

test('translateText: la URL solo lleva los parámetros del contrato y el init solo {signal}', async () => {
  const googleSeen = [];
  const myMemorySeen = [];
  const googleFetch = async (url, init) => {
    googleSeen.push({ url, init });
    return { ok: true, status: 200, json: async () => googleResponse('Hello') };
  };
  const myMemoryFetch = async (url, init) => {
    if (url.includes('translate.googleapis.com')) throw new Error('sin google');
    myMemorySeen.push({ url, init });
    throw new Error('sin mymemory');
  };

  // Google responde: solo una petición, con sus parámetros exactos.
  await translateText('Hola mundo', { fetchFn: googleFetch });
  assert.deepEqual([...new URL(googleSeen[0].url).searchParams.keys()].sort(), [
    'client',
    'dt',
    'q',
    'sl',
    'tl',
  ]);
  assert.deepEqual(Object.keys(googleSeen[0].init), ['signal']);
  assert.ok(googleSeen[0].init.signal instanceof AbortSignal);

  // Google falla: mymemory recibe solo q y langpair, y también solo el signal.
  await assert.rejects(translateText('Hola', { fetchFn: myMemoryFetch }));
  assert.deepEqual([...new URL(myMemorySeen[0].url).searchParams.keys()].sort(), ['langpair', 'q']);
  assert.deepEqual(Object.keys(myMemorySeen[0].init), ['signal']);
});

test('translateText: un tiempo agotado al leer el cuerpo se informa como timed out', async () => {
  const fetchFn = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw Object.assign(new Error('abortado'), { name: 'TimeoutError' });
    },
  });

  await assert.rejects(translateText('Hola', { fetchFn, timeoutMs: 2500 }), (error) => {
    assert.match(error.message, /timed out after 2\.5 s/);
    return true;
  });
});

test('translateText: targetLang es pide tl=es en google y langpair Autodetect|es en mymemory', async () => {
  const urls = [];
  const myMemoryFetch = async (url) => {
    urls.push(url);
    if (url.includes('translate.googleapis.com')) throw new Error('sin google');
    return {
      ok: true,
      status: 200,
      json: async () => ({ responseStatus: 200, responseData: { translatedText: 'Hola' } }),
    };
  };
  const googleFetch = async (url) => {
    urls.push(url);
    return { ok: true, status: 200, json: async () => googleResponse('Hola') };
  };

  await translateText('Hello', { targetLang: 'es', fetchFn: googleFetch });
  assert.match(urls[0], /tl=es/);

  urls.length = 0;
  await translateText('Hello', { targetLang: 'es', fetchFn: myMemoryFetch });
  assert.match(urls[1], /langpair=Autodetect%7Ces/);
});

test('translateText: un targetLang no admitido lanza RangeError sin red', async () => {
  let called = false;
  const fetchFn = async () => {
    called = true;
    return { ok: true, status: 200, json: async () => googleResponse('x') };
  };

  await assert.rejects(translateText('Hello', { targetLang: 'fr', fetchFn }), RangeError);
  assert.equal(called, false);
});
