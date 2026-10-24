import * as THREE from 'three';

export default class DayNightCycle {
  constructor(scene, world, hud, audioManager, questManager) {
    this.scene = scene;
    this.world = world;
    this.hud = hud;
    this.audioManager = audioManager;
    

    this.dayDuration = 1200; // 1200 seconds (20 min) full Day/Night cycle
    this.currentTime = 0.12; // Start in fresh morning (0=dawn, 0.25=noon, 0.5=dusk, 0.75=midnight)
    this.isDay = true;
    this.lastIsDay = true;

    // Valheim atmospheric palette (warm golden mist & Nordic skies)
    this.dawnSky = new THREE.Color(0xeb9c4d);
    this.noonSky = new THREE.Color(0xd4a066);
    this.duskSky = new THREE.Color(0xba5224);
    this.nightSky = new THREE.Color(0x0a101d);

    this.dawnHemiSky = new THREE.Color(0xffc27a);
    this.noonHemiSky = new THREE.Color(0xffe0b2);
    this.duskHemiSky = new THREE.Color(0xe67e22);
    this.nightHemiSky = new THREE.Color(0x283856);

    this.hemiGround = new THREE.Color(0x243b1c);
    this.nightHemiGround = new THREE.Color(0x08120a);

    this.tempColor = new THREE.Color();
    this.tempHemiColor = new THREE.Color();
  }

  update(delta) {
    // Dynamic time flow: Day & long golden evening progress at a relaxed, slow pace (0.65x)
    // Night is an intense, thrilling nocturnal challenge that progresses 1.6x faster
    const isNightPhase = this.currentTime >= 0.68 && this.currentTime < 0.98;
    const timeScale = isNightPhase ? 1.6 : 0.65;
    this.currentTime += (delta * timeScale) / this.dayDuration;
    if (this.currentTime >= 1) {
      this.currentTime -= 1;
    }

    // angle: 0 at dawn, PI/2 at noon, PI at dusk, 3PI/2 at midnight
    const angle = (this.currentTime - 0.25) * Math.PI * 2;

    const sunX = Math.sin(angle) * 120;
    const sunY = Math.cos(angle) * 120;
    const sunZ = 50;

    if (this.world && this.world.sun) {
      this.world.sun.position.set(sunX, sunY, sunZ);
      // Intensity is highest at noon (cos(0) = 1)
      const sunElevation = Math.max(0, Math.cos(angle));
      this.world.sun.intensity = sunElevation * 1.5;
    }

    if (this.world && this.world.moon) {
      this.world.moon.position.set(-sunX, -sunY, -sunZ);
      const moonElevation = Math.max(0, -Math.cos(angle));
      this.world.moon.intensity = moonElevation * 0.45;
    }

    this.isDay = sunY > 0;

    // Transition events
    if (this.lastIsDay && !this.isDay) {
      // Night falls
      if (this.hud) {
        this.hud.showNotification('🌙 Yö laskeutuu erämaahan... Varjopedot heräävät! Pysy nuotioiden valossa.', 5000);
      }
      if (this.audioManager && typeof this.audioManager.playNightWarning === 'function') {
        this.audioManager.playNightWarning();
      }
    } else if (!this.lastIsDay && this.isDay) {
      // Dawn breaks
      if (this.hud) {
        this.hud.showNotification('☀️ Aamunkoitto valkenee... Pohjoinen erämaa lämpenee ja usva haihtuu.', 4000);
        if (this.questManager) {
          this.questManager.onNightSurvived();
        }
      }
    }
    this.lastIsDay = this.isDay;

    // Smooth sky and fog blending across 4 phases:
    // [0 to 0.25]: dawn -> noon
    // [0.25 to 0.5]: noon -> dusk
    // [0.5 to 0.75]: dusk -> midnight
    // [0.75 to 1.0]: midnight -> dawn
    let targetSky = this.noonSky;
    let targetHemi = this.noonHemiSky;
    let fogDensity = 0.0065;

    if (this.currentTime < 0.25) {
      const t = this.currentTime / 0.25;
      this.tempColor.copy(this.dawnSky).lerp(this.noonSky, t);
      this.tempHemiColor.copy(this.dawnHemiSky).lerp(this.noonHemiSky, t);
      targetHemi = this.tempHemiColor;
      fogDensity = THREE.MathUtils.lerp(0.008, 0.006, t);
    } else if (this.currentTime < 0.5) {
      const t = (this.currentTime - 0.25) / 0.25;
      this.tempColor.copy(this.noonSky).lerp(this.duskSky, t);
      this.tempHemiColor.copy(this.noonHemiSky).lerp(this.duskHemiSky, t);
      targetHemi = this.tempHemiColor;
      fogDensity = THREE.MathUtils.lerp(0.006, 0.0075, t);
    } else if (this.currentTime < 0.75) {
      const t = (this.currentTime - 0.5) / 0.25;
      this.tempColor.copy(this.duskSky).lerp(this.nightSky, t);
      this.tempHemiColor.copy(this.duskHemiSky).lerp(this.nightHemiSky, t);
      targetHemi = this.tempHemiColor;
      fogDensity = THREE.MathUtils.lerp(0.0075, 0.012, t);
    } else {
      const t = (this.currentTime - 0.75) / 0.25;
      this.tempColor.copy(this.nightSky).lerp(this.dawnSky, t);
      this.tempHemiColor.copy(this.nightHemiSky).lerp(this.dawnHemiSky, t);
      targetHemi = this.tempHemiColor;
      fogDensity = THREE.MathUtils.lerp(0.012, 0.008, t);
    }

    if (this.scene.fog) {
      this.scene.fog.color.copy(this.tempColor);
      this.scene.fog.density = fogDensity;
    }

    if (this.world && this.world.skyMat) {
      this.world.skyMat.color.copy(this.tempColor);
    }

    if (this.world && this.world.hemiLight) {
      this.world.hemiLight.color.copy(targetHemi);
      this.world.hemiLight.groundColor.copy(this.isDay ? this.hemiGround : this.nightHemiGround);
    }
  }

  getCycleInfo() {
    return {
      isDay: this.isDay,
      time: this.currentTime,
      phase: this.currentTime < 0.25 ? 'Dawn' :
             this.currentTime < 0.5 ? 'Day' :
             this.currentTime < 0.75 ? 'Dusk' : 'Night'
    };
  }

  getClockTime() {
    // 0 = 06:00, 0.25 = 12:00, 0.5 = 18:00, 0.75 = 00:00
    const inGameHours = (this.currentTime * 24 + 6) % 24;
    const hours = Math.floor(inGameHours);
    const minutes = Math.floor((inGameHours % 1) * 60);
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');

    let phaseName = 'Keskipäivä';
    let icon = '☀️';
    if (hours >= 5 && hours < 9) {
      phaseName = 'Aamunkoitto';
      icon = '🌅';
    } else if (hours >= 9 && hours < 17) {
      phaseName = 'Keskipäivä';
      icon = '☀️';
    } else if (hours >= 17 && hours < 21) {
      phaseName = 'Iltahämärä';
      icon = '🌆';
    } else {
      phaseName = 'Sydänyö';
      icon = '🌙';
    }

    return {
      timeStr: `Klo ${hh}:${mm}`,
      phaseStr: `${icon} ${phaseName}`,
      hours,
      minutes,
      isDay: this.isDay
    };
  }
}
