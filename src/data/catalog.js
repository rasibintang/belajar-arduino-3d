// Daftar di menu "Komponen". lesson = id pelajaran tempat komponen pertama kali dipakai.
export const CATALOG = [
  // Dasar
  { icon: 'chip', name: 'Arduino Uno', desc: 'Otak rangkaian: membaca input, menjalankan kode, mengendalikan output.', lesson: 'board' },
  { icon: 'breadboard', name: 'Breadboard', desc: 'Merangkai tanpa solder. Lima lubang satu kolom saling tersambung.', lesson: 'blink' },
  { icon: 'wire', name: 'Kabel jumper', desc: 'Menyambungkan pin papan ke breadboard.', lesson: 'blink' },
  { icon: 'led', name: 'LED', desc: 'Lampu kecil satu arah: kaki panjang (+), kaki pendek (−).', lesson: 'blink' },
  { icon: 'resistor', name: 'Resistor', desc: 'Membatasi arus. Nilainya dibaca dari gelang warna.', lesson: 'blink' },
  { icon: 'button', name: 'Push button', desc: 'Menyambung rangkaian selama ditekan.', lesson: 'button' },
  { icon: 'knob', name: 'Potensiometer', desc: 'Resistor putar untuk mengatur tegangan 0–5 V.', lesson: 'knob' },
  { icon: 'rgb', name: 'LED RGB', desc: 'Merah, hijau, dan biru dalam satu lensa.', lesson: 'rgb' },
  { icon: 'sun', name: 'LDR', desc: 'Sensor cahaya: hambatannya turun saat terang.', lesson: 'light' },
  { icon: 'sonar', name: 'HC-SR04', desc: 'Sensor jarak ultrasonik 2–400 cm.', lesson: 'distance' },
  { icon: 'sound', name: 'Buzzer piezo', desc: 'Membunyikan nada dengan tone().', lesson: 'sound' },
  { icon: 'transistor', name: 'Transistor TIP120', desc: 'Saklar elektronik untuk beban berarus besar.', lesson: 'motor' },
  { icon: 'motor', name: 'Motor DC', desc: 'Berputar; kecepatannya diatur dengan PWM.', lesson: 'motor' },
  { icon: 'servo', name: 'Servo SG90', desc: 'Motor yang bisa diperintah ke sudut 0–180°.', lesson: 'servo' },
  { icon: 'traffic', name: 'Modul lampu lalu lintas', desc: 'Tiga LED berwarna dengan resistor bawaan.', lesson: 'project' },
  // Menengah
  { icon: 'lcd', name: 'LCD 16×2 I²C', desc: 'Layar dua baris teks, cukup 4 kabel.', lesson: 'lcd' },
  { icon: 'thermo', name: 'DHT11', desc: 'Sensor suhu dan kelembapan udara.', lesson: 'dht' },
  { icon: 'ledbar', name: 'Modul 8 LED', desc: 'Delapan LED berjajar dengan resistor bawaan.', lesson: 'arrays' },
  { icon: 'chip', name: 'Shift register 74HC595', desc: 'Menambah 8 output hanya dengan 3 pin.', lesson: 'shift' },
  { icon: 'keypad', name: 'Keypad 4×4', desc: '16 tombol dalam matriks baris dan kolom.', lesson: 'keypad' },
  { icon: 'joystick', name: 'Joystick', desc: 'Dua potensiometer (X, Y) dan satu tombol tekan.', lesson: 'joystick' },
  { icon: 'relay', name: 'Modul relay', desc: 'Saklar mekanis untuk beban listrik besar.', lesson: 'relay' },
  // Mahir
  { icon: 'knob', name: 'Rotary encoder', desc: 'Kenop tanpa batas putaran yang mengirim pulsa.', lesson: 'interrupt' },
  { icon: 'motor', name: 'Stepper 28BYJ-48', desc: 'Motor yang bergerak per langkah dengan presisi.', lesson: 'stepper' },
  { icon: 'chip', name: 'Driver L298N', desc: 'H-bridge ganda: dua motor, maju dan mundur.', lesson: 'hbridge' },
  { icon: 'clock', name: 'RTC DS3231', desc: 'Jam akurat yang tetap jalan berkat baterai.', lesson: 'rtc' },
  { icon: 'rgb', name: 'NeoPixel ring', desc: '12 LED RGB yang diatur lewat satu kabel data.', lesson: 'neopixel' },
  { icon: 'car', name: 'Sasis robot', desc: 'Dua roda bermotor, roda bebas, dan Arduino di atasnya.', lesson: 'robot' },
];
