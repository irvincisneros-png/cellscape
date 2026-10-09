// Data and lens-aware text for the human karyotype level.
// Chromosome lengths are GRCh38 assembly sizes (Mb). Centromeric indices (p / total) are the standard
// textbook / ISCN-style values used to classify centromere position at metaphase.
// Band tables are a STYLISED ideogram: the named G-bands follow the ISCN pattern at roughly the 300-band level
// (stain codes: n = gneg/light, 1-4 = gpos25/50/75/100, v = gvar heterochromatin, s = stalk), widths are relative
// and are normalised within each arm. The major landmarks (e.g. 1q12 heterochromatin, 9q12, Xq28, Yq12) are kept.

const T = (s) => s.trim().split(/\s+/).map((t) => { const [name, stain, w] = t.split(":"); return { name, stain, w: +w }; });

// id: [length Mb, centromere index, class, p-arm bands, q-arm bands]
const RAW = {
  1: [248.96, 0.48, "metacentric",
    "p36.33:n:2 p36.32:1:3 p36.31:n:2 p36.23:1:2 p36.22:n:3 p36.21:2:3 p36.13:n:4 p36.12:1:3 p36.11:n:4 p35:1:6 p34.3:n:5 p34.2:1:4 p34.1:n:3 p33:3:4 p32.3:n:5 p32.2:2:3 p32.1:n:2 p31.3:2:8 p31.2:n:1 p31.1:4:15 p22.3:n:3 p22.2:3:4 p22.1:n:3 p21.3:3:5 p21.2:n:3 p21.1:2:5 p13.3:n:5 p13.2:2:4 p13.1:n:2 p12:2:3 p11.2:n:1",
    "q12:v:13 q21.1:n:4 q21.2:2:3 q21.3:n:5 q22:2:2 q23.1:n:3 q23.2:2:1 q23.3:n:5 q24.1:2:2 q24.2:n:4 q24.3:3:2 q25.1:n:3 q25.2:2:4 q25.3:n:5 q31.1:4:5 q31.2:n:3 q31.3:4:5 q32.1:n:8 q32.2:1:4 q32.3:n:3 q41:4:10 q42.11:n:1 q42.12:1:2 q42.13:n:4 q42.2:2:4 q42.3:n:2 q43:3:7 q44:n:6"],
  2: [242.19, 0.39, "submetacentric",
    "p25.3:n:6 p25.2:1:3 p25.1:n:4 p24.3:3:6 p24.2:n:3 p24.1:2:3 p23.3:n:3 p23.2:1:2 p23.1:n:3 p22.3:3:5 p22.2:n:3 p22.1:2:3 p21:n:7 p16.3:3:5 p16.2:n:3 p16.1:2:3 p15:n:3 p14:2:3 p13.3:n:3 p13.2:1:3 p13.1:n:3 p12:3:6 p11.2:n:3",
    "q11.1:n:1 q11.2:2:3 q12.1:n:3 q12.2:1:2 q12.3:n:2 q13:2:4 q14.1:3:4 q14.2:n:3 q14.3:1:3 q21.1:2:5 q21.2:n:2 q21.3:1:3 q22.1:3:5 q22.2:n:2 q22.3:2:4 q23.1:n:3 q23.2:3:3 q23.3:n:3 q24.1:2:5 q24.2:n:3 q24.3:3:4 q31.1:n:5 q31.2:2:3 q31.3:n:3 q32.1:3:5 q32.2:n:4 q32.3:3:6 q33.1:n:4 q33.2:3:3 q33.3:n:3 q34:2:6 q35:3:6 q36.1:n:3 q36.2:2:4 q36.3:n:4 q37.1:3:3 q37.2:n:3 q37.3:2:3"],
  3: [198.3, 0.47, "metacentric",
    "p26.3:n:5 p26.2:2:3 p26.1:n:4 p25.3:3:5 p25.2:n:3 p25.1:2:4 p24.3:n:4 p24.2:3:5 p24.1:n:3 p23:2:4 p22.3:n:3 p22.2:3:3 p22.1:n:3 p21.33:2:3 p21.32:n:3 p21.31:2:4 p21.2:n:2 p21.1:2:3 p14.3:n:3 p14.2:3:3 p14.1:n:3 p13:2:3 p12.3:n:3 p12.2:4:4 p12.1:n:3 p11.2:2:3",
    "q11.2:n:3 q12.1:2:3 q12.2:n:2 q12.3:3:3 q13.11:n:3 q13.12:1:2 q13.13:n:2 q13.2:2:3 q13.31:n:3 q13.32:2:3 q13.33:n:3 q21.1:3:3 q21.2:n:2 q21.3:3:3 q22.1:n:3 q22.2:2:3 q22.3:n:3 q23:3:4 q24:n:5 q25.1:2:4 q25.2:n:3 q25.31:3:3 q25.32:n:2 q25.33:3:3 q26.1:n:5 q26.2:3:3 q26.31:n:3 q26.32:2:3 q26.33:n:3 q27.1:3:3 q27.2:n:3 q27.3:3:3 q28:n:5 q29:2:3"],
  4: [190.21, 0.27, "submetacentric",
    "p16.3:n:4 p16.2:3:3 p16.1:n:5 p15.33:2:3 p15.32:n:3 p15.31:3:4 p15.2:n:3 p15.1:3:6 p14:n:4 p13:2:3 p12:3:6 p11:n:2",
    "q11:n:2 q12:3:8 q13.1:4:4 q13.2:n:3 q13.3:2:3 q21.1:4:4 q21.21:n:3 q21.22:2:3 q21.23:n:2 q21.3:2:3 q22.1:4:4 q22.2:n:3 q22.3:4:4 q23:n:3 q24:2:4 q25:n:4 q26:4:6 q27:n:3 q28.1:2:3 q28.2:n:3 q28.3:4:4 q31.1:n:3 q31.21:1:3 q31.22:n:2 q31.23:1:3 q31.3:n:3 q32.1:4:4 q32.2:n:3 q32.3:4:4 q33:n:3 q34.1:3:3 q34.2:n:2 q34.3:4:4 q35.1:n:4 q35.2:1:3"],
  5: [181.54, 0.29, "submetacentric",
    "p15.33:n:3 p15.32:1:2 p15.31:n:3 p15.2:3:4 p15.1:n:4 p14.3:3:4 p14.2:n:3 p14.1:3:3 p13.3:n:3 p13.2:2:3 p13.1:n:3 p12:3:4 p11:n:2",
    "q11.1:n:1 q11.2:2:3 q12.1:3:3 q12.2:n:2 q12.3:3:3 q13.1:n:3 q13.2:2:3 q13.3:n:3 q14.1:3:3 q14.2:n:3 q14.3:3:4 q15:n:3 q21.1:4:4 q21.2:n:2 q21.3:3:3 q22.1:n:3 q22.2:2:3 q22.3:n:3 q23.1:4:4 q23.2:n:3 q23.3:3:3 q31.1:n:3 q31.2:2:3 q31.3:n:3 q32:3:3 q33.1:n:4 q33.2:3:3 q33.3:n:3 q34:4:5 q35.1:n:3 q35.2:2:3 q35.3:n:4"],
  6: [170.81, 0.35, "submetacentric",
    "p25.3:n:3 p25.2:2:3 p25.1:n:3 p24.3:2:3 p24.2:n:2 p24.1:2:3 p23:n:3 p22.3:3:4 p22.2:n:2 p22.1:2:3 p21.33:n:3 p21.32:2:3 p21.31:n:3 p21.2:2:4 p21.1:n:3 p12.3:3:3 p12.2:n:2 p12.1:3:3 p11.2:n:3",
    "q11.1:n:1 q12:3:5 q13:n:3 q14.1:3:3 q14.2:n:2 q14.3:3:3 q15:n:3 q16.1:2:3 q16.2:n:2 q16.3:3:3 q21:n:3 q22.1:3:3 q22.2:n:2 q22.31:3:3 q22.32:n:2 q22.33:2:3 q23.1:n:3 q23.2:3:3 q23.3:n:3 q24.1:2:3 q24.2:n:3 q24.3:3:3 q25.1:n:3 q25.2:2:3 q25.3:n:3 q26:3:4 q27:n:4"],
  7: [159.35, 0.4, "submetacentric",
    "p22.3:n:3 p22.2:2:2 p22.1:n:3 p21.3:3:4 p21.2:n:2 p21.1:2:3 p15.3:n:3 p15.2:2:3 p15.1:n:3 p14.3:3:3 p14.2:n:2 p14.1:3:3 p13:n:3 p12.3:3:3 p12.2:n:2 p12.1:3:3 p11.2:n:4",
    "q11.21:n:3 q11.22:2:3 q11.23:n:3 q21.11:3:4 q21.12:n:2 q21.13:3:3 q21.2:n:2 q21.3:2:3 q22.1:n:3 q22.2:2:2 q22.3:n:3 q31.1:3:3 q31.2:n:2 q31.31:3:3 q31.32:n:2 q31.33:2:3 q32.1:n:3 q32.2:2:3 q32.3:n:3 q33:3:3 q34:n:4 q35:2:3 q36.1:n:3 q36.2:2:3 q36.3:n:3"],
  8: [145.14, 0.31, "submetacentric",
    "p23.3:n:3 p23.2:2:3 p23.1:3:4 p22:n:3 p21.3:2:3 p21.2:n:2 p21.1:3:3 p12:n:3 p11.23:3:3 p11.22:n:2 p11.21:2:3 p11.1:n:1",
    "q11.1:n:1 q11.21:2:3 q11.22:n:3 q11.23:3:3 q12.1:n:3 q12.2:2:3 q12.3:n:3 q13.1:3:3 q13.2:n:2 q13.3:3:3 q21.11:n:3 q21.12:2:2 q21.13:n:3 q21.2:2:2 q21.3:n:3 q22.1:3:4 q22.2:n:3 q22.3:3:3 q23.1:n:3 q23.2:2:3 q23.3:n:3 q24.11:3:3 q24.12:n:2 q24.13:3:3 q24.21:n:2 q24.22:3:3 q24.3:n:4"],
  9: [138.39, 0.35, "submetacentric",
    "p24.3:n:4 p24.2:1:3 p24.1:n:4 p23:3:5 p22.3:n:3 p22.2:1:2 p22.1:n:3 p21.3:2:3 p21.2:n:3 p21.1:3:4 p13.3:n:3 p13.2:1:2 p13.1:n:3 p12:2:4 p11.2:n:3",
    "q12:v:12 q13:n:3 q21.11:2:3 q21.12:n:2 q21.13:2:3 q21.2:n:2 q21.31:3:3 q21.32:n:2 q21.33:3:3 q22.1:n:3 q22.2:2:3 q22.31:n:2 q22.32:2:3 q22.33:n:3 q31.1:3:4 q31.2:n:2 q31.3:2:3 q32:n:4 q33.1:3:3 q33.2:n:2 q33.3:2:3 q34.11:n:2 q34.12:2:2 q34.13:n:2 q34.2:1:2 q34.3:n:4"],
  10: [133.8, 0.33, "submetacentric",
    "p15.3:n:3 p15.2:2:2 p15.1:n:3 p14:3:3 p13:n:3 p12.33:3:3 p12.32:n:2 p12.31:3:3 p12.2:n:2 p12.1:2:3 p11.23:n:3 p11.22:2:2 p11.21:n:3 p11.1:n:1",
    "q11.1:n:1 q11.21:3:3 q11.22:n:2 q11.23:3:3 q21.1:n:4 q21.2:2:3 q21.3:3:3 q22.1:n:3 q22.2:2:2 q22.3:3:3 q23.1:n:3 q23.2:2:2 q23.31:n:3 q23.32:2:2 q23.33:n:2 q24.1:3:3 q24.2:n:2 q24.31:3:3 q24.32:n:2 q24.33:3:3 q25.1:n:3 q25.2:2:3 q25.3:n:3 q26.11:3:3 q26.12:n:2 q26.13:3:3 q26.2:n:2 q26.3:2:3"],
  11: [135.09, 0.39, "submetacentric",
    "p15.5:n:2 p15.4:1:2 p15.3:n:2 p15.2:3:2 p15.1:n:2 p14.3:3:3 p14.2:n:2 p14.1:3:2 p13:n:2 p12:3:4 p11.2:n:3 p11.12:3:2 p11.11:n:1",
    "q11:n:1 q12.1:4:3 q12.2:n:1 q12.3:3:2 q13.1:n:3 q13.2:2:2 q13.3:n:2 q13.4:2:2 q13.5:n:2 q14.1:3:3 q14.2:n:2 q14.3:3:3 q21:n:3 q22.1:4:3 q22.2:n:2 q22.3:3:3 q23.1:n:2 q23.2:3:3 q23.3:n:3 q24.1:2:3 q24.2:n:2 q24.3:3:3 q25:n:3"],
  12: [133.28, 0.27, "submetacentric",
    "p13.33:n:3 p13.32:2:2 p13.31:n:3 p13.2:2:2 p13.1:n:3 p12.3:3:3 p12.2:n:2 p12.1:3:3 p11.23:n:3 p11.22:2:3 p11.21:n:2 p11.1:n:1",
    "q11:n:1 q12:3:4 q13.11:n:2 q13.12:2:2 q13.13:n:2 q13.2:2:2 q13.3:n:2 q14.1:3:3 q14.2:n:2 q14.3:3:3 q15:n:3 q21.1:3:3 q21.2:n:2 q21.31:3:3 q21.32:n:2 q21.33:3:3 q22:n:3 q23.1:2:3 q23.2:n:2 q23.3:3:3 q24.11:n:2 q24.12:2:2 q24.13:n:2 q24.21:3:3 q24.22:n:2 q24.23:3:2 q24.31:n:3 q24.32:2:2 q24.33:n:2"],
  13: [114.36, 0.14, "acrocentric",
    "p13:n:35 p12:s:25 p11.2:n:40",
    "q11:n:2 q12.11:3:3 q12.12:n:2 q12.13:3:2 q12.2:n:2 q12.3:2:3 q13:n:3 q14.11:2:3 q14.12:n:2 q14.13:3:2 q14.2:n:3 q14.3:2:3 q21.1:n:3 q21.2:3:3 q21.31:n:3 q21.32:3:3 q21.33:n:3 q22:2:3 q31.1:n:4 q31.2:3:3 q31.3:n:4 q32.1:2:3 q32.2:n:2 q32.3:3:3 q33.1:n:3 q33.2:2:3 q33.3:n:3 q34:3:5"],
  14: [107.04, 0.16, "acrocentric",
    "p13:n:35 p12:s:25 p11.2:n:40",
    "q11.1:n:2 q11.2:2:3 q12:n:3 q13.1:3:3 q13.2:n:2 q13.3:3:2 q21.1:n:3 q21.2:2:3 q21.3:n:3 q22.1:3:3 q22.2:n:2 q22.3:2:3 q23.1:n:3 q23.2:2:3 q23.3:n:3 q24.1:3:3 q24.2:n:3 q24.3:2:4 q31.1:n:3 q31.2:3:3 q31.3:n:3 q32.11:2:3 q32.12:n:2 q32.13:3:2 q32.2:n:3 q32.31:3:3 q32.32:n:2 q32.33:3:3"],
  15: [101.99, 0.18, "acrocentric",
    "p13:n:35 p12:s:25 p11.2:n:40",
    "q11.1:n:2 q11.2:3:2 q12:n:3 q13.1:2:3 q13.2:n:2 q13.3:2:2 q14:n:3 q15.1:3:3 q15.2:n:2 q15.3:2:3 q21.1:n:3 q21.2:3:3 q21.3:n:3 q22.1:2:3 q22.2:n:2 q22.31:3:3 q22.32:n:2 q22.33:2:3 q23:n:3 q24.1:3:3 q24.2:n:2 q24.3:2:3 q25.1:n:3 q25.2:3:3 q25.3:n:3 q26.1:2:4 q26.2:n:3 q26.3:3:3"],
  16: [90.34, 0.4, "metacentric",
    "p13.3:n:5 p13.2:1:2 p13.13:n:2 p13.12:1:2 p13.11:n:3 p12.3:3:3 p12.2:n:2 p12.1:3:3 p11.2:n:4 p11.1:n:1",
    "q11.1:n:1 q11.2:v:4 q12.1:3:3 q12.2:n:2 q13:n:3 q21:2:3 q22.1:n:3 q22.2:2:2 q22.3:n:2 q23.1:3:3 q23.2:n:2 q23.3:2:3 q24.1:n:3 q24.2:2:2 q24.3:n:4"],
  17: [83.26, 0.33, "submetacentric",
    "p13.3:n:5 p13.2:2:2 p13.1:n:3 p12:3:4 p11.2:n:4 p11.1:n:1",
    "q11.1:n:1 q11.2:3:3 q12:n:3 q21.1:2:3 q21.2:n:2 q21.31:3:3 q21.32:n:2 q21.33:3:3 q22:n:3 q23.1:3:3 q23.2:n:2 q23.3:3:3 q24.1:n:3 q24.2:2:3 q24.3:n:2 q25.1:3:3 q25.2:n:2 q25.3:3:3"],
  18: [80.37, 0.27, "submetacentric",
    "p11.32:n:3 p11.31:2:3 p11.22:n:3 p11.21:3:3 p11.1:n:1",
    "q11.1:n:1 q11.2:3:3 q12.1:n:3 q12.2:4:3 q12.3:n:3 q21.1:3:4 q21.2:n:2 q21.31:3:3 q21.32:n:2 q21.33:3:3 q22.1:4:4 q22.2:n:2 q22.3:3:3 q23:n:5"],
  19: [58.62, 0.47, "metacentric",
    "p13.3:n:6 p13.2:2:3 p13.12:n:2 p13.11:3:2 p12:n:5 p11:2:2",
    "q11:n:1 q12:3:3 q13.11:n:3 q13.12:3:3 q13.13:n:2 q13.2:2:3 q13.31:n:2 q13.32:3:3 q13.33:n:3 q13.41:2:2 q13.42:n:3 q13.43:3:3"],
  20: [64.44, 0.45, "metacentric",
    "p13:n:4 p12.3:3:3 p12.2:n:3 p12.1:3:3 p11.23:n:3 p11.22:2:2 p11.21:n:3 p11.1:n:1",
    "q11.1:n:1 q11.21:3:2 q11.22:n:2 q11.23:3:2 q12:n:3 q13.11:2:2 q13.12:n:2 q13.13:2:2 q13.2:n:3 q13.31:3:2 q13.32:n:2 q13.33:3:3"],
  21: [46.71, 0.23, "acrocentric",
    "p13:n:35 p12:s:25 p11.2:n:40",
    "q11.1:n:1 q11.2:2:3 q21.1:n:4 q21.2:3:3 q21.3:n:3 q22.11:4:3 q22.12:n:2 q22.13:3:3 q22.2:n:3 q22.3:2:4"],
  22: [50.82, 0.27, "acrocentric",
    "p13:n:35 p12:s:25 p11.2:n:40",
    "q11.1:n:1 q11.21:3:3 q11.22:n:2 q11.23:3:3 q12.1:n:2 q12.2:2:2 q12.3:n:3 q13.1:3:3 q13.2:n:2 q13.31:3:3 q13.32:n:2 q13.33:2:3"],
  X: [156.04, 0.4, "submetacentric",
    "p22.33:n:3 p22.32:2:3 p22.31:n:2 p22.2:3:3 p22.13:n:2 p22.12:2:2 p22.11:n:2 p21.3:3:3 p21.2:n:2 p21.1:3:3 p11.4:n:3 p11.3:4:2 p11.23:n:2 p11.22:3:2 p11.21:n:2 p11.1:n:1",
    "q11.1:n:1 q12:n:2 q13.1:3:2 q13.2:n:2 q13.3:2:2 q21.1:3:3 q21.2:n:2 q21.31:3:3 q21.32:n:2 q21.33:3:3 q22.1:n:3 q22.2:2:2 q22.3:n:3 q23:3:3 q24:n:3 q25:4:4 q26.1:n:3 q26.2:2:2 q26.3:n:2 q27.1:3:3 q27.2:n:2 q27.3:3:3 q28:n:8"],
  Y: [57.23, 0.3, "acrocentric",
    "p11.32:n:2 p11.31:1:2 p11.2:n:4",
    "q11.1:n:1 q11.21:n:2 q11.221:3:2 q11.222:n:2 q11.223:2:2 q11.23:n:3 q12:v:30"],
};

export const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, "X", "Y"];
export const STAIN_VAL = { n: 0.04, 1: 0.25, 2: 0.5, 3: 0.75, 4: 1, v: 0.8, s: 0 };
export const UM_PER_MB = 10 / 248.956;           // chromosome 1 is drawn about 10 µm long at metaphase

/** Parsed chromosome table: { id, mb, ci, cls, lenUm, pLen, qLen, bands:[{name, stain, u0, u1}] (u: 0 = p tip → 1 = q tip) }. */
export const CHROMS = {};
for (const id of IDS) {
  const [mb, ci, cls, ps, qs] = RAW[id];
  const arm = (list, u0, u1) => {
    const b = T(list), tot = b.reduce((a, x) => a + x.w, 0);
    let u = u0;
    return b.map((x) => { const s = { name: x.name, stain: x.stain, u0: u, u1: (u += ((u1 - u0) * x.w) / tot) }; return s; });
  };
  const half = 0.012;                              // the centromere gets a narrow band of its own
  const bands = [...arm(ps, 0, ci - half), { name: "cen", stain: "a", u0: ci - half, u1: ci + half }, ...arm(qs, ci + half, 1)];
  const lenUm = mb * UM_PER_MB;
  CHROMS[id] = { id, mb, ci, cls, lenUm, pLen: lenUm * ci, qLen: lenUm * (1 - ci), bands };
}

/** u (0..1) at the centre of a named band, e.g. bandU(11, "p15.4"). */
export function bandU(id, name) {
  const b = CHROMS[id].bands.find((x) => x.name === name);
  return b ? (b.u0 + b.u1) / 2 : CHROMS[id].ci;
}
/** Group letter, size order. */
export const GROUPS = [
  { g: "A", ids: [1, 2, 3], note: "largest, metacentric / submetacentric" },
  { g: "B", ids: [4, 5], note: "large, submetacentric" },
  { g: "C", ids: [6, 7, 8, 9, 10, 11, 12], note: "medium, submetacentric (X is similar)" },
  { g: "D", ids: [13, 14, 15], note: "medium, acrocentric with satellites" },
  { g: "E", ids: [16, 17, 18], note: "small, metacentric / submetacentric" },
  { g: "F", ids: [19, 20], note: "small, metacentric" },
  { g: "G", ids: [21, 22], note: "smallest, acrocentric with satellites (Y is similar)" },
];
export const groupOf = (id) => GROUPS.find((x) => x.ids.includes(id))?.g || (id === "X" ? "C*" : id === "Y" ? "G*" : "");
export const ROWS = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11, 12], [13, 14, 15, 16, 17, 18], [19, 20, 21, 22, "S"]];

// ---------- gene loci (real, ISCN-located) ----------
// bands: the ISCN band(s) the marker sits in; marker is at their centre.
export const GENES = [
  {
    id: "hbb", sym: "HBB", chr: 11, loc: "11p15.4", bands: ["p15.4"], preset: "sickle", pattern: "autosomal recessive", color: "#fb7185",
    codes: "the β-globin chain of haemoglobin, the oxygen-carrying protein in red blood cells",
    trait: { "y7-8": "A change in this gene makes red blood cells bend into a sickle shape (sickle cell disease).", "y9-10": "Sickle cell disease: the mutation GAG → GTG swaps glutamic acid for valine at position 6, so haemoglobin clumps and red cells sickle.", y11: "Sickle cell disease (HbS, Glu6Val). HbS/HbS people are affected; heterozygotes (sickle-cell trait) are usually healthy and have some protection against severe malaria, which is why the allele persists where malaria is common." },
    inherit: { "y7-8": "You need two copies of the changed gene to have the disease (recessive).", "y9-10": "Autosomal recessive: both alleles must be HbS. Two carrier parents have a 1 in 4 chance of an affected child each pregnancy.", y11: "Autosomal recessive. Carrier × carrier gives 25% HbS/HbS, 50% carriers, 25% HbA/HbA, a new independent chance in every pregnancy." },
    note: "This is the same β-globin gene you saw in the nucleus, chromatin and DNA levels.",
  },
  {
    id: "cftr", sym: "CFTR", chr: 7, loc: "7q31.2", bands: ["q31.2"], preset: "cf", pattern: "autosomal recessive", color: "#38bdf8",
    codes: "a channel protein that moves chloride (and bicarbonate) ions across the membranes of cells lining the lungs, gut and sweat ducts",
    trait: { "y7-8": "A faulty version makes thick, sticky mucus in the lungs and gut (cystic fibrosis).", "y9-10": "Cystic fibrosis: faulty CFTR channels leave mucus thick and sticky, which clogs the airways and the pancreas ducts.", y11: "Cystic fibrosis. Loss of CFTR function reduces chloride and water secretion, so mucus is dehydrated and viscous. The most common variant (ΔF508) deletes one phenylalanine, so the protein misfolds and is degraded before reaching the membrane." },
    inherit: { "y7-8": "You need two faulty copies to have it (recessive). About 1 in 25 people of European ancestry carry one.", "y9-10": "Autosomal recessive. Carriers have one working copy and are healthy; about 1 in 25 people of European ancestry are carriers.", y11: "Autosomal recessive. Carrier frequency is about 1 in 25 in people of European ancestry, so about 1 in 2,500 babies are affected." },
    note: "",
  },
  {
    id: "htt", sym: "HTT", chr: 4, loc: "4p16.3", bands: ["p16.3"], preset: "huntington", color: "#a78bfa", pattern: "autosomal dominant",
    codes: "huntingtin, a protein found in nerve cells",
    trait: { "y7-8": "A changed copy slowly damages nerve cells, usually showing up in adulthood (Huntington's disease).", "y9-10": "Huntington's disease: a repeated CAG triplet becomes too long, making a harmful huntingtin protein. Symptoms usually start in adulthood.", y11: "Huntington's disease, caused by an expanded CAG repeat (36 or more repeats; about 40 or more is fully penetrant). The extra glutamines make the protein toxic to neurons. Longer repeats tend to mean earlier onset (anticipation, especially via the father)." },
    inherit: { "y7-8": "Only one changed copy is needed (dominant), so a child of an affected parent has a 1 in 2 chance.", "y9-10": "Autosomal dominant: one copy is enough. A child of an affected parent has a 50% chance of inheriting it.", y11: "Autosomal dominant with age-dependent penetrance: symptoms usually appear in adulthood, so the allele can be passed on before it is known." },
    note: "",
  },
  {
    id: "f8", sym: "F8", chr: "X", loc: "Xq28", bands: ["q28"], preset: "haemophilia", color: "#f87171", pattern: "X-linked recessive",
    codes: "clotting factor VIII, a protein needed for blood to clot",
    trait: { "y7-8": "Without it, blood clots slowly (haemophilia A).", "y9-10": "Haemophilia A: a faulty factor VIII means clotting is slow, so bleeding is prolonged and joints bleed easily.", y11: "Haemophilia A: reduced factor VIII activity impairs the intrinsic clotting pathway. Severity depends on residual activity; treatment is factor VIII replacement." },
    inherit: { "y7-8": "The gene is on the X chromosome. Boys have only one X, so one faulty copy is enough; girls usually have a healthy second copy.", "y9-10": "X-linked recessive: males (XY) with the allele are affected; females (XX) are usually carriers. A carrier mother has a 1 in 2 chance of passing it to each child; fathers never pass an X-linked allele to sons.", y11: "X-linked recessive. Affected males cannot pass it to sons (they give the Y) but all their daughters are carriers. Females can be affected if homozygous, or occasionally through skewed X-inactivation." },
    note: "",
  },
  {
    id: "dmd", sym: "DMD", chr: "X", loc: "Xp21.2", bands: ["p21.2"], preset: "dmd", color: "#fb923c", pattern: "X-linked recessive",
    codes: "dystrophin, a protein that anchors muscle fibres to the structures around them",
    trait: { "y7-8": "A faulty gene means muscles gradually weaken (Duchenne muscular dystrophy).", "y9-10": "Duchenne muscular dystrophy: without dystrophin, muscle fibres tear during contraction and are slowly lost.", y11: "Duchenne muscular dystrophy. DMD is one of the largest human genes (about 2.2 million base pairs), which makes deletions and other changes relatively common; about one third of cases are new mutations." },
    inherit: { "y7-8": "It sits on the X chromosome, so it mostly affects boys.", "y9-10": "X-linked recessive: mostly affects males; carrier mothers usually have no or mild symptoms.", y11: "X-linked recessive. Carrier females can show mild effects (X-inactivation mosaicism) and, in a third of cases, the mutation is new (not inherited)." },
    note: "",
  },
  {
    id: "sry", sym: "SRY", chr: "Y", loc: "Yp11.2", bands: ["p11.2"], preset: null, color: "#4ade80", pattern: "Y-linked",
    codes: "a protein that switches on genes that make an embryo's gonads develop as testes",
    trait: { "y7-8": "This small gene on the Y chromosome is the switch that makes a baby develop as a boy.", "y9-10": "SRY triggers the embryo's gonads to become testes. Testes then make the hormones that guide male development.", y11: "SRY (sex-determining region Y) encodes a transcription factor that starts testis determination (via SOX9). It sits near the pseudoautosomal boundary, which is why a crossing-over mistake between X and Y can move it onto an X (46,XX males) or leave a Y without it (46,XY females)." },
    inherit: { "y7-8": "Only people with a Y chromosome have it, and it is passed from father to son.", "y9-10": "Y-linked: passed from father to son only.", y11: "Y-linked inheritance: transmitted from father to son. It is a single copy per cell (hemizygous)." },
    note: "There is no Inheritance lab preset for SRY because it is not inherited in a Punnett-square pattern.",
  },
  {
    id: "abo", sym: "ABO", chr: 9, loc: "9q34.2", bands: ["q34.2"], preset: "abo", color: "#facc15", pattern: "codominant (multiple alleles)",
    codes: "an enzyme that adds a sugar to molecules on the surface of red blood cells",
    trait: { "y7-8": "It decides your blood group (A, B, AB or O).", "y9-10": "It determines blood group. The A and B alleles make slightly different enzymes; the O allele makes none that works.", y11: "ABO blood group. I^A adds N-acetylgalactosamine and I^B adds galactose to the H antigen; the O allele (a frameshift) makes no active enzyme, so the H antigen is unmodified." },
    inherit: { "y7-8": "There are three versions (A, B and O). A and B both show up if you have both.", "y9-10": "Three alleles: I^A and I^B are codominant (both expressed, giving group AB) and i is recessive.", y11: "Multiple alleles with codominance (I^A, I^B) and recessiveness (i). Four phenotypes, six genotypes." },
    note: "",
  },
  {
    id: "eyes", sym: "OCA2 / HERC2", chr: 15, loc: "15q12–q13.1", bands: ["q12", "q13.1"], preset: "eyes", color: "#34d399", pattern: "polygenic (several genes)",
    codes: "OCA2 makes a membrane protein in pigment cells that affects how much melanin is made; a control region inside the neighbouring HERC2 gene switches OCA2 up or down",
    trait: { "y7-8": "These genes help decide how much brown pigment is in the iris, so they help set eye colour.", "y9-10": "Eye colour is not controlled by one gene. OCA2 and HERC2 have the biggest effect on blue versus brown, and several other genes add smaller effects.", y11: "A regulatory variant in HERC2 reduces OCA2 expression and so lowers melanin in the iris, giving blue eyes in many people. Eye colour is polygenic, so the simple brown-dominant, blue-recessive rule is only a rough approximation." },
    inherit: { "y7-8": "Several genes work together, so eye colour doesn't follow a simple pattern.", "y9-10": "Polygenic: many genes each add a small effect, so there are many shades.", y11: "Polygenic with a few major loci (OCA2/HERC2) plus others, plus environmental and developmental variation in iris pigmentation." },
    note: "",
  },
  {
    id: "mc1r", sym: "MC1R", chr: 16, loc: "16q24.3", bands: ["q24.3"], preset: "mc1r", color: "#f97316", pattern: "autosomal recessive (simplified)",
    codes: "the melanocortin 1 receptor on pigment cells, which controls whether they make dark (eumelanin) or red-yellow (pheomelanin) pigment",
    trait: { "y7-8": "Some versions give red hair and fair skin.", "y9-10": "Red hair: reduced-function MC1R variants shift pigment cells toward red-yellow pheomelanin, giving red hair and fair skin that burns easily.", y11: "Loss-of-function MC1R alleles reduce cAMP signalling, so melanocytes make more pheomelanin and less eumelanin: red hair, fair skin, freckling and higher UV sensitivity." },
    inherit: { "y7-8": "Usually needs two copies of the red-hair version (recessive).", "y9-10": "Simplified as autosomal recessive: two reduced-function copies usually give red hair. Real inheritance is a little more complicated.", y11: "Usually described as recessive, but alleles differ in strength (R and r), there is some effect in heterozygotes, and other genes modify the result." },
    note: "",
  },
  {
    id: "lct", sym: "LCT", chr: 2, loc: "2q21.3", bands: ["q21.3"], preset: "lactose", color: "#e2e8f0", pattern: "autosomal dominant",
    codes: "lactase, the enzyme that digests the milk sugar lactose",
    trait: { "y7-8": "In many people this gene switches off after childhood so milk sugar becomes hard to digest. In others it stays on.", "y9-10": "Lactase persistence: in some people the LCT gene stays active into adulthood, so they can digest lactose. In most of the world's adults it switches off.", y11: "Lactase persistence. Variants in a regulatory region just upstream (inside the neighbouring MCM6 gene) keep LCT switched on in adults. It has evolved independently several times in populations with a history of dairying." },
    inherit: { "y7-8": "One copy of the 'keeps working' version is enough (dominant).", "y9-10": "Autosomal dominant: one lactase-persistence allele is enough to keep digesting lactose.", y11: "Autosomal dominant (regulatory allele). Note that lactase persistence is the dominant trait and the ancestral, switch-off form is recessive." },
    note: "",
  },
];
export const GENE_BY_ID = Object.fromEntries(GENES.map((g) => [g.id, g]));
export const genesOn = (id) => GENES.filter((g) => g.chr === id);

// ---------- aneuploidy ----------
export const CONDITIONS = {
  none: { label: "Typical", short: "46" },
  t21: {
    label: "Down syndrome", name: "trisomy 21", plus: "+21",
    text: {
      "y7-8": "This person has three copies of chromosome 21 instead of two (47 chromosomes). It causes Down syndrome.",
      "y9-10": "Trisomy 21: three copies of chromosome 21 cause Down syndrome (about 1 in 700 births). It usually happens when the two copies of chromosome 21 fail to separate in meiosis (nondisjunction), so an egg or sperm carries two.",
      y11: "47,XX,+21 or 47,XY,+21 (trisomy 21, Down syndrome; roughly 1 in 700 births). About 95% of cases are free trisomy from nondisjunction, mostly in maternal meiosis I; a few arise from a Robertsonian translocation or mosaicism. Chromosome 21 is small, so the extra dosage is compatible with life.",
    },
  },
  xxy: {
    label: "Klinefelter", name: "47,XXY", plus: "",
    text: {
      "y9-10": "Klinefelter syndrome (47,XXY): two X chromosomes and a Y. SRY still makes the person male. About 1 in 500 to 1 in 1,000 male births.",
      y11: "47,XXY (Klinefelter syndrome; about 1 in 500 to 1,000 male births). SRY on the Y gives a male phenotype, but the extra X reduces testosterone and often fertility. One X is inactivated in each cell, so these cells show one Barr body.",
    },
  },
  turner: {
    label: "Turner", name: "45,X", plus: "",
    text: {
      "y9-10": "Turner syndrome (45,X): only one X chromosome and no second sex chromosome. It usually causes short stature and ovaries that do not work normally. Most 45,X pregnancies end in miscarriage.",
      y11: "45,X (Turner syndrome; about 1 in 2,000 to 2,500 female births). Monosomy X is the only viable monosomy in humans, and most 45,X conceptions are miscarried. With no SRY the gonads develop as ovaries but are often under-developed. These cells have no Barr body.",
    },
  },
};

export const NOTE = {
  "y7-8": "A karyotype is a photograph of every chromosome from one cell, arranged in pairs. Real karyotypes are made from white blood cells caught in the middle of dividing.",
  "y9-10": "This is a stylised human metaphase spread: 46 chromosomes, each already copied into two sister chromatids. Band patterns and lengths are simplified from standard ideograms.",
  y11: "Stylised metaphase spread (not a micrograph). Lengths are scaled to the genome (chromosome 1 about 10 µm) and band patterns follow the ISCN G-banding at roughly the 300-band level, simplified. Real chromosome length at metaphase varies with how condensed the cell is.",
};

export const PLANT_NOTE = "These are human chromosomes. Plants have their own sets: a tomato has 12 pairs, a wheat plant 21 (bread wheat is hexaploid, 2n = 42), and the research plant <em>Arabidopsis</em> just 5 pairs.";

export const CLASS_TEXT = {
  metacentric: { "y7-8": "centromere near the middle", "y9-10": "metacentric: centromere near the middle, arms about equal", y11: "metacentric: centromere index about 0.375 to 0.5, p and q arms nearly equal" },
  submetacentric: { "y7-8": "centromere a bit off-centre", "y9-10": "submetacentric: centromere off-centre, one arm clearly shorter", y11: "submetacentric: centromere index about 0.25 to 0.375, short p arm clearly shorter than q" },
  acrocentric: { "y7-8": "centromere near one end, with a little knob (satellite)", "y9-10": "acrocentric: centromere near one end, a tiny short arm", y11: "acrocentric: centromere index below about 0.25; chromosomes 13, 14, 15, 21 and 22 carry satellites on stalks (nucleolar organiser regions) on their short arms" },
};

// ---------- missions and quiz ----------
export const MISSIONS = [
  { text: "Drag a chromosome onto its look-alike partner to make a pair", check: (S) => S.everPaired, maxBand: "y7-8" },
  { text: "Press Count and watch the chromosomes being counted", check: (S) => S.counted, maxBand: "y7-8" },
  { text: "Pair up all the chromosomes", check: (S) => S.allPaired },
  { text: "Sort the chromosomes into a karyogram", check: (S) => S.everSorted },
  { text: "Find the sex chromosomes: select an X or Y chromosome", check: (S) => S.sexSelected },
  { text: "Spot the extra chromosome: view Down syndrome (trisomy 21) and select chromosome 21", check: (S) => S.t21Selected, band: "y9-10" },
  { text: "Find the gene for sickle cell disease on its chromosome", check: (S) => S.seenGene.has("hbb") },
  { text: "Karyogram challenge: drag every chromosome to its numbered slot", check: (S) => S.challengeDone, band: "y9-10", maxBand: "y9-10" },
  { text: "Find HBB (11p15.4) and CFTR (7q31.2) using their ISCN addresses", check: (S) => S.seenGene.has("hbb") && S.seenGene.has("cftr"), band: "y11", maxBand: "y12" },
];

export const QUIZ = [
  // Y7-8
  { maxBand: "y7-8", q: "How many chromosomes are in a typical human body cell?", options: ["23", "46", "92", "44"], answer: 1, why: "46, arranged as 23 pairs. Egg and sperm cells have 23." },
  { maxBand: "y7-8", q: "Where does each pair of chromosomes come from?", options: ["Both from the mother", "Both from the father", "One from each parent", "They are made new in the embryo"], answer: 2, why: "You get one chromosome of every pair from your mother and the other from your father." },
  { maxBand: "y7-8", q: "A gene is…", options: ["a whole chromosome", "a section of a chromosome", "a type of cell", "a protein"], answer: 1, why: "Genes are sections of DNA along a chromosome. Each chromosome carries many." },
  { maxBand: "y7-8", q: "Which pair of chromosomes usually makes a person female?", options: ["XY", "XX", "YY", "X only"], answer: 1, why: "Females usually have two X chromosomes (XX); males usually have an X and a Y (XY)." },
  { maxBand: "y7-8", q: "A karyotype is…", options: ["a picture of a cell's chromosomes arranged in pairs", "a family tree", "a type of gene", "the nucleus of a cell"], answer: 0, why: "A karyotype lets scientists count the chromosomes and look for extra, missing or changed ones." },
  // Y9-10
  { band: "y9-10", maxBand: "y9-10", q: "Which karyotype is a typical male?", options: ["46,XX", "46,XY", "47,XXY", "45,X"], answer: 1, why: "46 chromosomes, with an X and a Y." },
  { band: "y9-10", maxBand: "y9-10", q: "How many pairs of autosomes does a typical person have?", options: ["1", "22", "23", "46"], answer: 1, why: "22 pairs of autosomes (non-sex chromosomes) plus the pair of sex chromosomes makes 23 pairs." },
  { band: "y9-10", maxBand: "y9-10", q: "A karyotype reads 47,XX,+21. What does it show?", options: ["Turner syndrome", "Klinefelter syndrome", "Down syndrome (trisomy 21)", "A typical female"], answer: 2, why: "There are 47 chromosomes with an extra chromosome 21: trisomy 21, or Down syndrome." },
  { band: "y9-10", maxBand: "y9-10", q: "What usually causes an extra or missing chromosome?", options: ["Nondisjunction in meiosis", "Too much sunlight", "A change to one base of DNA", "The egg being too big"], answer: 0, why: "Chromosomes (or sister chromatids) fail to separate in meiosis, so a gamete has one too many or one too few." },
  { band: "y9-10", maxBand: "y9-10", q: "Which statement about trisomy 21 and maternal age is correct?", options: ["Risk does not change with age", "Risk rises as the mother gets older", "Risk falls as the mother gets older", "Only fathers' age matters"], answer: 1, why: "Eggs begin meiosis before birth and wait; the chance of nondisjunction rises as the mother gets older." },
  { band: "y9-10", maxBand: "y9-10", q: "Why do scientists look at the centromere position and size in a karyotype?", options: ["To tell which chromosome is which", "To count the cell's mitochondria", "To measure body temperature", "To find the cell's age"], answer: 0, why: "Length, centromere position and banding pattern identify each chromosome so that extras and missing ones can be spotted." },
  // Y11
  { band: "y11", q: "Chromosome 21 has its centromere near one end and carries satellites. What type is it?", options: ["Metacentric", "Submetacentric", "Acrocentric", "Telocentric"], answer: 2, why: "Chromosomes 13, 14, 15, 21 and 22 are acrocentric. (Humans have no true telocentric chromosomes.)" },
  { band: "y11", q: "In G-banding with Giemsa, dark bands tend to be…", options: ["GC-rich and gene-rich", "AT-rich and gene-poor", "free of DNA", "made of RNA"], answer: 1, why: "Giemsa-dark (G-positive) bands are AT-rich, later-replicating and relatively gene-poor; light bands are GC-rich and gene-rich." },
  { band: "y11", q: "A cell with 69 chromosomes (69,XXX) is an example of…", options: ["aneuploidy", "polyploidy (triploidy)", "monosomy", "trisomy"], answer: 1, why: "Whole extra sets of chromosomes are polyploidy. Aneuploidy is a gain or loss of single chromosomes (e.g. 47 or 45)." },
  { band: "y11", q: "How many Barr bodies (inactive X) would a 47,XXY cell have?", options: ["0", "1", "2", "3"], answer: 1, why: "The number of Barr bodies is the number of X chromosomes minus one: here 2 − 1 = 1." },
  { band: "y11", q: "What does the ISCN address 11p15.4 mean?", options: ["Chromosome 11, long arm, band 15.4", "Chromosome 11, short arm, region 1, band 5.4", "11 genes on 15 chromosomes", "Chromosome 15, band 11.4"], answer: 1, why: "Chromosome number, arm (p = short, q = long), then region, band and sub-band counted from the centromere outwards." },
  { band: "y11", q: "Which gene on the Y chromosome starts male (testis) development?", options: ["HBB", "SRY", "F8", "CFTR"], answer: 1, why: "SRY encodes a transcription factor that triggers testis determination." },
];

// ---------- narrative ----------
const sexNote = (S) => (S.cond === "turner" ? "45,X" : S.cond === "xxy" ? "47,XXY" : S.sex === "XX" ? "46,XX" : "46,XY");
export function narrative(S, lens) {
  const L = (v) => lens.pick(v);
  const total = S.total;
  const lines = [];
  if (S.view === "karyogram") lines.push(L({
    "y7-8": `All ${total} chromosomes are lined up in pairs from biggest to smallest. This picture is a <strong>karyotype</strong>.`,
    "y9-10": `A <strong>karyogram</strong>: the ${S.autosomes} autosomes in pairs by size and centromere position (groups A to G), then the sex chromosomes. Karyotype: <strong>${S.notation}</strong>.`,
    y11: `Karyogram (${S.notation}). Chromosomes are ordered by length, then centromere position and banding; X resembles group C and Y group G.`,
  }));
  else if (S.pairsFound) lines.push(L({
    "y7-8": `You have matched ${S.pairsFound} of ${S.pairsExpected} pairs. Look at the length, the centromere (pinched spot) and the pattern of stripes.`,
    "y9-10": `${S.pairsFound} of ${S.pairsExpected} homologous pairs found. Homologues match in length, centromere position and banding.`,
    y11: `${S.pairsFound} of ${S.pairsExpected} homologous groups matched by length, centromere index and G-banding pattern.`,
  }));
  else lines.push(L({
    "y7-8": `This is a cell with its ${total} chromosomes spread out, caught in the middle of dividing. Each is X-shaped because it has been copied.`,
    "y9-10": `A metaphase spread: ${total} chromosomes, each made of two identical sister chromatids joined at the centromere. Find each chromosome's homologous partner.`,
    y11: `Metaphase spread (${S.notation}): ${total} chromosomes, each with two sister chromatids. Banding comes from Giemsa staining after trypsin; dark bands are AT-rich and gene-poor.`,
  }));
  if (S.cond !== "none") lines.push(L(CONDITIONS[S.cond].text));
  else if (S.view === "karyogram") lines.push(L({ "y7-8": S.sex === "XY" ? "The last pair is X and Y, so this is a boy." : "The last pair is two Xs, so this is a girl.", "y9-10": S.sex === "XY" ? "The X and a much smaller Y make this a male karyotype." : "Two X chromosomes make this a female karyotype.", y11: S.sex === "XY" ? "SRY on the Y short arm triggers testis development. One of the two X chromosomes in a female cell is inactivated (a Barr body)." : "In each XX cell one X is randomly inactivated early in development, forming a Barr body; the other X stays active." }));
  if (S.sel) {
    const g = S.sel.gene;
    lines.push(g ? L({ "y7-8": `You selected the <strong>${g.sym}</strong> gene on chromosome ${S.sel.id}.`, "y9-10": `<strong>${g.sym}</strong> sits at <strong>${g.loc}</strong> on chromosome ${S.sel.id}.`, y11: `<strong>${g.sym}</strong>: ${g.loc} (${g.pattern}).` })
      : S.sel.revealed ? L({ "y7-8": `Chromosome ${S.sel.id} selected. Click a gene to see where it sits.`, "y9-10": `Chromosome ${S.sel.id} selected (${S.sel.cls}). Genes are sections of the chromosome.`, y11: `Chromosome ${S.sel.id} (${S.sel.cls}, ${S.sel.mb} Mb). Loci are written as chromosome, arm (p/q), region and band.` })
        : "Chromosome selected. Which numbered pair is it? Pair it up or sort the spread to find out.");
  }
  return lines.map((l) => `<p>${l}</p>`).join("");
}
export { sexNote };
