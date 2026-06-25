with open('c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/data/index.js', 'rb') as f:
    content = f.read()

replacements = [
    (b"{ name: 'Toyota',         logo: '/assets/logos/toyota.png',          cat: 'VL \xc2\xb7 G4-G1',                    group: 'vl',",
     b"{ name: 'Toyota',         logo: '/assets/logos/toyota.png',          cat: 'VL \xc2\xb7 G4-G1',                    group: 'vl',       bu: 'motors',"),
    (b"{ name: 'Mercedes-Benz',  logo: '/assets/logos/mercedes.png',        cat: 'VL \xc2\xb7 BASIC-CERTIFIED',          group: 'vl',",
     b"{ name: 'Mercedes-Benz',  logo: '/assets/logos/mercedes.png',        cat: 'VL \xc2\xb7 BASIC-CERTIFIED',          group: 'vl',       bu: 'motors',"),
    (b"{ name: 'Suzuki',         logo: '/assets/logos/suzuki.png',          cat: 'VL \xc2\xb7 Bronze-Gold',              group: 'vl',",
     b"{ name: 'Suzuki',         logo: '/assets/logos/suzuki.png',          cat: 'VL \xc2\xb7 Bronze-Gold',              group: 'vl',       bu: 'motors',"),
    (b"{ name: 'BYD',            logo: '/assets/logos/byd.png',             cat: 'VL \xc2\xb7 BEV',                      group: 'vl',",
     b"{ name: 'BYD',            logo: '/assets/logos/byd.png',             cat: 'VL \xc2\xb7 BEV',                      group: 'vl',       bu: 'motors',"),
    (b"{ name: 'Mitsubishi',     logo: '/assets/logos/mitsubishi.png',      cat: 'VL \xc2\xb7 Step 1-3',                 group: 'vl',",
     b"{ name: 'Mitsubishi',     logo: '/assets/logos/mitsubishi.png',      cat: 'VL \xc2\xb7 Step 1-3',                 group: 'vl',       bu: 'motors',"),
    (b"{ name: 'Omoda & Jaecoo', logo: '/assets/logos/omoda.png',           cat: 'VL \xc2\xb7 Premium',                  group: 'vl',",
     b"{ name: 'Omoda & Jaecoo', logo: '/assets/logos/omoda.png',           cat: 'VL \xc2\xb7 Premium',                  group: 'vl',       bu: 'motors',"),
    (b"{ name: 'Stellantis',     logo: '/assets/logos/stellantis.png',      cat: 'VL \xc2\xb7 Citro\xc3\xabn\xc2\xb7Peugeot\xc2\xb7Jeep\xc2\xb7Fiat',group: 'vl',",
     b"{ name: 'Stellantis',     logo: '/assets/logos/stellantis.png',      cat: 'VL \xc2\xb7 Citro\xc3\xabn\xc2\xb7Peugeot\xc2\xb7Jeep\xc2\xb7Fiat',group: 'vl',       bu: 'motors',"),
    (b"{ name: 'Citro\xc3\xabn',        logo: '/assets/logos/citroen.png',         cat: 'VL \xc2\xb7 Stellantis',               group: 'vl',",
     b"{ name: 'Citro\xc3\xabn',        logo: '/assets/logos/citroen.png',         cat: 'VL \xc2\xb7 Stellantis',               group: 'vl',       bu: 'motors',"),
    (b"{ name: 'Yamaha',         logo: null,                                 cat: 'Moto & Bateaux',                group: 'moto',",
     b"{ name: 'Yamaha',         logo: null,                                 cat: 'Moto & Bateaux',                group: 'moto',     bu: 'motors',"),
    (b"{ name: 'Renault Trucks', logo: '/assets/logos/renault-trucks.png',  cat: 'Camions',                       group: 'camions',",
     b"{ name: 'Renault Trucks', logo: '/assets/logos/renault-trucks.png',  cat: 'Camions',                       group: 'camions',  bu: 'equipment',"),
    (b"{ name: 'Hino',           logo: '/assets/logos/hino.png',            cat: 'Camions',                       group: 'camions',",
     b"{ name: 'Hino',           logo: '/assets/logos/hino.png',            cat: 'Camions',                       group: 'camions',  bu: 'equipment',"),
    (b"{ name: 'Fuso',           logo: '/assets/logos/fuso.png',            cat: 'Camions \xc2\xb7 Utilitaires',         group: 'camions',",
     b"{ name: 'Fuso',           logo: '/assets/logos/fuso.png',            cat: 'Camions \xc2\xb7 Utilitaires',         group: 'camions',  bu: 'equipment',"),
    (b"{ name: 'Sinotruk',       logo: '/assets/logos/sinotruk.png',        cat: 'Camions lourds',                group: 'camions',",
     b"{ name: 'Sinotruk',       logo: '/assets/logos/sinotruk.png',        cat: 'Camions lourds',                group: 'camions',  bu: 'equipment',"),
    (b"{ name: 'Shacman',        logo: '/assets/logos/shacman.png',         cat: 'Camions BTP',                   group: 'camions',",
     b"{ name: 'Shacman',        logo: '/assets/logos/shacman.png',         cat: 'Camions BTP',                   group: 'camions',  bu: 'equipment',"),
    (b"{ name: 'Mercedes Trucks',logo: '/assets/logos/mercedes.png',        cat: 'Camions premium',               group: 'camions',",
     b"{ name: 'Mercedes Trucks',logo: '/assets/logos/mercedes.png',        cat: 'Camions premium',               group: 'camions',  bu: 'equipment',"),
    (b"{ name: 'King Long',      logo: '/assets/logos/kinglong.png',        cat: 'Bus \xc2\xb7 Transport',               group: 'bus',",
     b"{ name: 'King Long',      logo: '/assets/logos/kinglong.png',        cat: 'Bus \xc2\xb7 Transport',               group: 'bus',      bu: 'equipment',"),
    (b"{ name: 'Toyota Bus',     logo: '/assets/logos/toyota.png',          cat: 'Bus',                           group: 'bus',",
     b"{ name: 'Toyota Bus',     logo: '/assets/logos/toyota.png',          cat: 'Bus',                           group: 'bus',      bu: 'equipment',"),
    (b"{ name: 'BT',             logo: '/assets/logos/bt.png',              cat: 'Chariots \xc2\xb7 Forklift',           group: 'chariots',",
     b"{ name: 'BT',             logo: '/assets/logos/bt.png',              cat: 'Chariots \xc2\xb7 Forklift',           group: 'chariots', bu: 'equipment',"),
    (b"{ name: 'Toyota Material',logo: '/assets/logos/toyota-forklift.png', cat: 'Chariots \xc2\xb7 Forklift',           group: 'chariots',",
     b"{ name: 'Toyota Material',logo: '/assets/logos/toyota-forklift.png', cat: 'Chariots \xc2\xb7 Forklift',           group: 'chariots', bu: 'equipment',"),
    (b"{ name: 'JCB',            logo: '/assets/logos/jcb.png',             cat: 'Engins TP',                     group: 'engins',",
     b"{ name: 'JCB',            logo: '/assets/logos/jcb.png',             cat: 'Engins TP',                     group: 'engins',   bu: 'equipment',"),
    (b"{ name: 'Lovol',          logo: '/assets/logos/lovol.png',           cat: 'Engins \xc2\xb7 Agri',                 group: 'engins',",
     b"{ name: 'Lovol',          logo: '/assets/logos/lovol.png',           cat: 'Engins \xc2\xb7 Agri',                 group: 'engins',   bu: 'equipment',"),
]

ok = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        ok += 1
    else:
        print(f'MISS: {old[10:50]}')

with open('c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/data/index.js', 'wb') as f:
    f.write(content)

print(f'{ok}/{len(replacements)} OK')
