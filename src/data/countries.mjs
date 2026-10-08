// Countries: ISO 3166-1 names, alpha-2 and alpha-3 codes, international dialling code and flag.
// Source: ISO 3166-1 (193 UN member states plus Palestine and Vatican City) with ITU E.164 dialling codes.
// The three-letter code identifies the country (India = IND); the dialling code (+91) is a different thing.
// `nsn` is the usual length of the national significant number (min, max) used to sanity-check phone numbers.

export const COUNTRY_DATA = [
  ['Afghanistan', 'AF', 'AFG', '93', [9, 9]], ['Albania', 'AL', 'ALB', '355', [9, 9]], ['Algeria', 'DZ', 'DZA', '213', [9, 9]], ['Andorra', 'AD', 'AND', '376', [6, 9]], ['Angola', 'AO', 'AGO', '244', [9, 9]],
  ['Antigua and Barbuda', 'AG', 'ATG', '1', [10, 10]], ['Argentina', 'AR', 'ARG', '54', [10, 11]], ['Armenia', 'AM', 'ARM', '374', [8, 8]], ['Australia', 'AU', 'AUS', '61', [9, 9]], ['Austria', 'AT', 'AUT', '43', [10, 13]],
  ['Azerbaijan', 'AZ', 'AZE', '994', [9, 9]], ['Bahamas', 'BS', 'BHS', '1', [10, 10]], ['Bahrain', 'BH', 'BHR', '973', [8, 8]], ['Bangladesh', 'BD', 'BGD', '880', [10, 10]], ['Barbados', 'BB', 'BRB', '1', [10, 10]],
  ['Belarus', 'BY', 'BLR', '375', [9, 9]], ['Belgium', 'BE', 'BEL', '32', [9, 9]], ['Belize', 'BZ', 'BLZ', '501', [7, 7]], ['Benin', 'BJ', 'BEN', '229', [8, 10]], ['Bhutan', 'BT', 'BTN', '975', [8, 8]],
  ['Bolivia', 'BO', 'BOL', '591', [8, 8]], ['Bosnia and Herzegovina', 'BA', 'BIH', '387', [8, 9]], ['Botswana', 'BW', 'BWA', '267', [7, 8]], ['Brazil', 'BR', 'BRA', '55', [10, 11]], ['Brunei', 'BN', 'BRN', '673', [7, 7]],
  ['Bulgaria', 'BG', 'BGR', '359', [8, 9]], ['Burkina Faso', 'BF', 'BFA', '226', [8, 8]], ['Burundi', 'BI', 'BDI', '257', [8, 8]], ['Cabo Verde', 'CV', 'CPV', '238', [7, 7]], ['Cambodia', 'KH', 'KHM', '855', [8, 9]],
  ['Cameroon', 'CM', 'CMR', '237', [9, 9]], ['Canada', 'CA', 'CAN', '1', [10, 10]], ['Central African Republic', 'CF', 'CAF', '236', [8, 8]], ['Chad', 'TD', 'TCD', '235', [8, 8]], ['Chile', 'CL', 'CHL', '56', [9, 9]],
  ['China', 'CN', 'CHN', '86', [11, 11]], ['Colombia', 'CO', 'COL', '57', [10, 10]], ['Comoros', 'KM', 'COM', '269', [7, 7]], ['Congo', 'CG', 'COG', '242', [9, 9]], ['Costa Rica', 'CR', 'CRI', '506', [8, 8]],
  ['Côte d’Ivoire', 'CI', 'CIV', '225', [10, 10]], ['Croatia', 'HR', 'HRV', '385', [8, 9]], ['Cuba', 'CU', 'CUB', '53', [8, 8]], ['Cyprus', 'CY', 'CYP', '357', [8, 8]], ['Czechia', 'CZ', 'CZE', '420', [9, 9]],
  ['Democratic Republic of the Congo', 'CD', 'COD', '243', [9, 9]], ['Denmark', 'DK', 'DNK', '45', [8, 8]], ['Djibouti', 'DJ', 'DJI', '253', [8, 8]], ['Dominica', 'DM', 'DMA', '1', [10, 10]], ['Dominican Republic', 'DO', 'DOM', '1', [10, 10]],
  ['Ecuador', 'EC', 'ECU', '593', [9, 9]], ['Egypt', 'EG', 'EGY', '20', [10, 10]], ['El Salvador', 'SV', 'SLV', '503', [8, 8]], ['Equatorial Guinea', 'GQ', 'GNQ', '240', [9, 9]], ['Eritrea', 'ER', 'ERI', '291', [7, 7]],
  ['Estonia', 'EE', 'EST', '372', [7, 8]], ['Eswatini', 'SZ', 'SWZ', '268', [8, 8]], ['Ethiopia', 'ET', 'ETH', '251', [9, 9]], ['Fiji', 'FJ', 'FJI', '679', [7, 7]], ['Finland', 'FI', 'FIN', '358', [9, 10]],
  ['France', 'FR', 'FRA', '33', [9, 9]], ['Gabon', 'GA', 'GAB', '241', [7, 8]], ['Gambia', 'GM', 'GMB', '220', [7, 7]], ['Georgia', 'GE', 'GEO', '995', [9, 9]], ['Germany', 'DE', 'DEU', '49', [10, 11]],
  ['Ghana', 'GH', 'GHA', '233', [9, 9]], ['Greece', 'GR', 'GRC', '30', [10, 10]], ['Grenada', 'GD', 'GRD', '1', [10, 10]], ['Guatemala', 'GT', 'GTM', '502', [8, 8]], ['Guinea', 'GN', 'GIN', '224', [9, 9]],
  ['Guinea-Bissau', 'GW', 'GNB', '245', [9, 9]], ['Guyana', 'GY', 'GUY', '592', [7, 7]], ['Haiti', 'HT', 'HTI', '509', [8, 8]], ['Honduras', 'HN', 'HND', '504', [8, 8]], ['Hungary', 'HU', 'HUN', '36', [9, 9]],
  ['Iceland', 'IS', 'ISL', '354', [7, 7]], ['India', 'IN', 'IND', '91', [10, 10]], ['Indonesia', 'ID', 'IDN', '62', [9, 12]], ['Iran', 'IR', 'IRN', '98', [10, 10]], ['Iraq', 'IQ', 'IRQ', '964', [10, 10]],
  ['Ireland', 'IE', 'IRL', '353', [9, 9]], ['Israel', 'IL', 'ISR', '972', [9, 9]], ['Italy', 'IT', 'ITA', '39', [9, 10]], ['Jamaica', 'JM', 'JAM', '1', [10, 10]], ['Japan', 'JP', 'JPN', '81', [10, 10]],
  ['Jordan', 'JO', 'JOR', '962', [9, 9]], ['Kazakhstan', 'KZ', 'KAZ', '7', [10, 10]], ['Kenya', 'KE', 'KEN', '254', [9, 9]], ['Kiribati', 'KI', 'KIR', '686', [8, 8]], ['Kuwait', 'KW', 'KWT', '965', [8, 8]],
  ['Kyrgyzstan', 'KG', 'KGZ', '996', [9, 9]], ['Laos', 'LA', 'LAO', '856', [9, 10]], ['Latvia', 'LV', 'LVA', '371', [8, 8]], ['Lebanon', 'LB', 'LBN', '961', [7, 8]], ['Lesotho', 'LS', 'LSO', '266', [8, 8]],
  ['Liberia', 'LR', 'LBR', '231', [8, 9]], ['Libya', 'LY', 'LBY', '218', [9, 9]], ['Liechtenstein', 'LI', 'LIE', '423', [7, 7]], ['Lithuania', 'LT', 'LTU', '370', [8, 8]], ['Luxembourg', 'LU', 'LUX', '352', [9, 9]],
  ['Madagascar', 'MG', 'MDG', '261', [9, 9]], ['Malawi', 'MW', 'MWI', '265', [9, 9]], ['Malaysia', 'MY', 'MYS', '60', [9, 10]], ['Maldives', 'MV', 'MDV', '960', [7, 7]], ['Mali', 'ML', 'MLI', '223', [8, 8]],
  ['Malta', 'MT', 'MLT', '356', [8, 8]], ['Marshall Islands', 'MH', 'MHL', '692', [7, 7]], ['Mauritania', 'MR', 'MRT', '222', [8, 8]], ['Mauritius', 'MU', 'MUS', '230', [8, 8]], ['Mexico', 'MX', 'MEX', '52', [10, 10]],
  ['Micronesia', 'FM', 'FSM', '691', [7, 7]], ['Moldova', 'MD', 'MDA', '373', [8, 8]], ['Monaco', 'MC', 'MCO', '377', [8, 9]], ['Mongolia', 'MN', 'MNG', '976', [8, 8]], ['Montenegro', 'ME', 'MNE', '382', [8, 8]],
  ['Morocco', 'MA', 'MAR', '212', [9, 9]], ['Mozambique', 'MZ', 'MOZ', '258', [9, 9]], ['Myanmar', 'MM', 'MMR', '95', [8, 10]], ['Namibia', 'NA', 'NAM', '264', [9, 9]], ['Nauru', 'NR', 'NRU', '674', [7, 7]],
  ['Nepal', 'NP', 'NPL', '977', [10, 10]], ['Netherlands', 'NL', 'NLD', '31', [9, 9]], ['New Zealand', 'NZ', 'NZL', '64', [8, 10]], ['Nicaragua', 'NI', 'NIC', '505', [8, 8]], ['Niger', 'NE', 'NER', '227', [8, 8]],
  ['Nigeria', 'NG', 'NGA', '234', [10, 10]], ['North Korea', 'KP', 'PRK', '850', [8, 10]], ['North Macedonia', 'MK', 'MKD', '389', [8, 8]], ['Norway', 'NO', 'NOR', '47', [8, 8]], ['Oman', 'OM', 'OMN', '968', [8, 8]],
  ['Pakistan', 'PK', 'PAK', '92', [10, 10]], ['Palau', 'PW', 'PLW', '680', [7, 7]], ['Palestine', 'PS', 'PSE', '970', [9, 9]], ['Panama', 'PA', 'PAN', '507', [8, 8]], ['Papua New Guinea', 'PG', 'PNG', '675', [8, 8]],
  ['Paraguay', 'PY', 'PRY', '595', [9, 9]], ['Peru', 'PE', 'PER', '51', [9, 9]], ['Philippines', 'PH', 'PHL', '63', [10, 10]], ['Poland', 'PL', 'POL', '48', [9, 9]], ['Portugal', 'PT', 'PRT', '351', [9, 9]],
  ['Qatar', 'QA', 'QAT', '974', [8, 8]], ['Romania', 'RO', 'ROU', '40', [9, 9]], ['Russia', 'RU', 'RUS', '7', [10, 10]], ['Rwanda', 'RW', 'RWA', '250', [9, 9]], ['Saint Kitts and Nevis', 'KN', 'KNA', '1', [10, 10]],
  ['Saint Lucia', 'LC', 'LCA', '1', [10, 10]], ['Saint Vincent and the Grenadines', 'VC', 'VCT', '1', [10, 10]], ['Samoa', 'WS', 'WSM', '685', [7, 7]], ['San Marino', 'SM', 'SMR', '378', [8, 10]], ['São Tomé and Príncipe', 'ST', 'STP', '239', [7, 7]],
  ['Saudi Arabia', 'SA', 'SAU', '966', [9, 9]], ['Senegal', 'SN', 'SEN', '221', [9, 9]], ['Serbia', 'RS', 'SRB', '381', [8, 9]], ['Seychelles', 'SC', 'SYC', '248', [7, 7]], ['Sierra Leone', 'SL', 'SLE', '232', [8, 8]],
  ['Singapore', 'SG', 'SGP', '65', [8, 8]], ['Slovakia', 'SK', 'SVK', '421', [9, 9]], ['Slovenia', 'SI', 'SVN', '386', [8, 8]], ['Solomon Islands', 'SB', 'SLB', '677', [7, 7]], ['Somalia', 'SO', 'SOM', '252', [8, 9]],
  ['South Africa', 'ZA', 'ZAF', '27', [9, 9]], ['South Korea', 'KR', 'KOR', '82', [9, 10]], ['South Sudan', 'SS', 'SSD', '211', [9, 9]], ['Spain', 'ES', 'ESP', '34', [9, 9]], ['Sri Lanka', 'LK', 'LKA', '94', [9, 9]],
  ['Sudan', 'SD', 'SDN', '249', [9, 9]], ['Suriname', 'SR', 'SUR', '597', [7, 7]], ['Sweden', 'SE', 'SWE', '46', [9, 9]], ['Switzerland', 'CH', 'CHE', '41', [9, 9]], ['Syria', 'SY', 'SYR', '963', [9, 9]],
  ['Tajikistan', 'TJ', 'TJK', '992', [9, 9]], ['Tanzania', 'TZ', 'TZA', '255', [9, 9]], ['Thailand', 'TH', 'THA', '66', [9, 9]], ['Timor-Leste', 'TL', 'TLS', '670', [7, 8]], ['Togo', 'TG', 'TGO', '228', [8, 8]],
  ['Tonga', 'TO', 'TON', '676', [7, 7]], ['Trinidad and Tobago', 'TT', 'TTO', '1', [10, 10]], ['Tunisia', 'TN', 'TUN', '216', [8, 8]], ['Türkiye', 'TR', 'TUR', '90', [10, 10]], ['Turkmenistan', 'TM', 'TKM', '993', [8, 8]],
  ['Tuvalu', 'TV', 'TUV', '688', [5, 7]], ['Uganda', 'UG', 'UGA', '256', [9, 9]], ['Ukraine', 'UA', 'UKR', '380', [9, 9]], ['United Arab Emirates', 'AE', 'ARE', '971', [9, 9]], ['United Kingdom', 'GB', 'GBR', '44', [10, 10]],
  ['United States', 'US', 'USA', '1', [10, 10]], ['Uruguay', 'UY', 'URY', '598', [8, 8]], ['Uzbekistan', 'UZ', 'UZB', '998', [9, 9]], ['Vanuatu', 'VU', 'VUT', '678', [7, 7]], ['Vatican City', 'VA', 'VAT', '39', [9, 10]],
  ['Venezuela', 'VE', 'VEN', '58', [10, 10]], ['Vietnam', 'VN', 'VNM', '84', [9, 9]], ['Yemen', 'YE', 'YEM', '967', [9, 9]], ['Zambia', 'ZM', 'ZMB', '260', [9, 9]], ['Zimbabwe', 'ZW', 'ZWE', '263', [9, 9]],
];

const flagOf = (alpha2) => String.fromCodePoint(...[...alpha2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

/** One record per country: { name, alpha2, alpha3, dial, flag, nsn } — the shape the forms use. */
export const COUNTRIES = COUNTRY_DATA.map(([name, alpha2, alpha3, dial, nsn]) => ({ name, alpha2, alpha3, dial: `+${dial}`, flag: flagOf(alpha2), nsn }));

/** Country names only (the request form's searchable list). */
export const countries = COUNTRIES.map((c) => c.name);

export const countryByAlpha3 = (code) => COUNTRIES.find((c) => c.alpha3 === String(code ?? '').toUpperCase()) ?? null;
export const countryByName = (name) => COUNTRIES.find((c) => c.name.toLowerCase() === String(name ?? '').trim().toLowerCase()) ?? null;
