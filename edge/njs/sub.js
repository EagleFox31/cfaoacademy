// Qui appelle : `sub` et `azp` du jeton Bearer, pour le journal d'accès seulement.
// Le jeton n'est PAS vérifié ici : c'est l'API qui le vérifie. La supervision ne
// retient une ligne que si l'API a répondu moins de 400, donc avec un jeton valide.
// Rien d'autre du jeton n'est lu ; une valeur au format inattendu donne "".

var SUB = /^[A-Za-z0-9-]{1,64}$/;
var AZP = /^[A-Za-z0-9._-]{1,64}$/;

function claims(r) {
    var header = r.headersIn['Authorization'] || '';
    if (header.length > 8192 || header.slice(0, 7).toLowerCase() !== 'bearer ') {
        return null;
    }
    var parts = header.slice(7).trim().split('.');
    if (parts.length !== 3) {
        return null;
    }
    try {
        var payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        return payload !== null && typeof payload === 'object' ? payload : null;
    } catch (e) {
        return null;
    }
}

function pick(r, name, format) {
    var c = claims(r);
    var value = c ? c[name] : null;
    return typeof value === 'string' && format.test(value) ? value : '';
}

function sub(r) {
    return pick(r, 'sub', SUB);
}

function azp(r) {
    return pick(r, 'azp', AZP);
}

export default { sub, azp };
