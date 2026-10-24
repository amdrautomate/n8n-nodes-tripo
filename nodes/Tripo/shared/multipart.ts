/**
 * Minimal multipart/form-data encoder. Tripo's file upload endpoint (POST /files) takes a
 * multipart body with one file part; building the body by hand keeps the package free of
 * runtime dependencies (a requirement for verified community nodes) and independent of
 * the HTTP client's FormData support.
 */

export interface MultipartFile {
	field: string;
	filename: string;
	contentType: string;
	data: Buffer;
}

export type MultipartFieldValue = string | number | boolean | Array<string | number>;

export interface MultipartBody {
	body: Buffer;
	contentType: string;
}

const CRLF = '\r\n';

function randomBoundary(): string {
	let out = '----n8nTripo';
	for (let i = 0; i < 24; i++) {
		out += Math.floor(Math.random() * 36).toString(36);
	}
	return out;
}

/** Encodes text fields (arrays become repeated fields) and file parts into one body. */
export function encodeMultipart(
	fields: Record<string, MultipartFieldValue | undefined>,
	files: MultipartFile[],
): MultipartBody {
	const boundary = randomBoundary();
	const chunks: Buffer[] = [];

	const pushField = (name: string, value: string | number | boolean) => {
		chunks.push(
			Buffer.from(
				`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${String(value)}${CRLF}`,
				'utf8',
			),
		);
	};

	for (const [name, value] of Object.entries(fields)) {
		if (value === undefined || value === null || value === '') continue;
		if (Array.isArray(value)) {
			for (const entry of value) pushField(name, entry);
		} else {
			pushField(name, value);
		}
	}

	for (const file of files) {
		const safeName = file.filename.replace(/["\r\n]/g, '_');
		chunks.push(
			Buffer.from(
				`--${boundary}${CRLF}Content-Disposition: form-data; name="${file.field}"; filename="${safeName}"${CRLF}Content-Type: ${file.contentType}${CRLF}${CRLF}`,
				'utf8',
			),
		);
		chunks.push(file.data);
		chunks.push(Buffer.from(CRLF, 'utf8'));
	}

	chunks.push(Buffer.from(`--${boundary}--${CRLF}`, 'utf8'));

	return {
		body: Buffer.concat(chunks),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}
