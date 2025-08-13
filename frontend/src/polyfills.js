import { Buffer } from 'buffer';

// Attach Node-like globals expected by some libraries
if (typeof window !== 'undefined') {
  if (!window.global) window.global = window;
  if (!window.Buffer) window.Buffer = Buffer;
}

// Graceful fallback for incorrect WASM Content-Type or proxy issues in dev
if (typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiateStreaming === 'function') {
  const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
  WebAssembly.instantiateStreaming = async (sourcePromise, importObject) => {
    try {
      return await originalInstantiateStreaming(sourcePromise, importObject);
    } catch (err) {
      console.warn('WASM streaming failed, trying direct fetch:', err.message);
      try {
        const response = await sourcePromise;
        
        // Check if response looks corrupted
        if (!response.ok) {
          throw new Error(`Bad response: ${response.status}`);
        }
        
        const contentLength = response.headers.get('content-length');
        console.log(`WASM content-length: ${contentLength}`);
        
        const bytes = await response.arrayBuffer();
        console.log(`WASM actual bytes: ${bytes.byteLength}`);
        
        // Validate WASM magic number
        const view = new Uint8Array(bytes);
        if (view.length < 4 || view[0] !== 0x00 || view[1] !== 0x61 || view[2] !== 0x73 || view[3] !== 0x6d) {
          throw new Error('Invalid WASM magic number - file may be corrupted');
        }
        
        return await WebAssembly.instantiate(bytes, importObject);
      } catch (err2) {
        console.error('WASM fallback also failed:', err2);
        throw err2 || err;
      }
    }
  };
}
