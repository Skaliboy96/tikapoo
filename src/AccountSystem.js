/**
 * AccountSystem – Built-in account management and profile save storage.
 * Eliminates the need to export/import JSON files manually.
 * Players create an account with a Username & Password; all character progression,
 * equipment, hotbar, skills, quests, and building data are stored automatically under their profile.
 */
export default class AccountSystem {
  constructor(saveSystem = null) {
    this.saveSystem = saveSystem;
    this.storageKey = 'tikapoo_player_accounts_v1';
    this.currentAccountKey = 'tikapoo_active_account_user';
    this.currentAccount = null;

    this.init();
  }

  init() {
    // Attempt auto-login if active account exists
    const activeUser = localStorage.getItem(this.currentAccountKey);
    if (activeUser) {
      const accounts = this._getAccounts();
      if (accounts[activeUser]) {
        this.currentAccount = accounts[activeUser];
      }
    }
  }

  _getAccounts() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('[AccountSystem] parse error:', e);
      return {};
    }
  }

  _saveAccounts(accounts) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(accounts));
    } catch (e) {
      console.error('[AccountSystem] storage error:', e);
    }
  }

  /**
   * Registers a new account profile
   */
  register(username, password) {
    const trimmedUser = (username || '').trim();
    const trimmedPass = (password || '').trim();

    if (!trimmedUser || trimmedUser.length < 3) {
      return { success: false, message: 'Käyttäjätunnuksen tulee olla vähintään 3 merkkiä pitkä.' };
    }
    if (!trimmedPass || trimmedPass.length < 3) {
      return { success: false, message: 'Salasanan tulee olla vähintään 3 merkkiä pitkä.' };
    }

    const accounts = this._getAccounts();
    const userKey = trimmedUser.toLowerCase();

    if (accounts[userKey]) {
      return { success: false, message: 'Tämä käyttäjätunnus on jo käytössä! Valitse toinen nimi tai kirjaudu sisään.' };
    }

    const newProfile = {
      username: trimmedUser,
      password: trimmedPass,
      createdAt: new Date().toISOString(),
      lastPlayed: new Date().toISOString(),
      saveData: null
    };

    accounts[userKey] = newProfile;
    this._saveAccounts(accounts);

    this.currentAccount = newProfile;
    localStorage.setItem(this.currentAccountKey, userKey);

    return { success: true, message: `Tili luotu onnistuneesti! Tervetuloa, ${trimmedUser}!`, profile: newProfile };
  }

  /**
   * Logs into an existing account profile
   */
  login(username, password) {
    const trimmedUser = (username || '').trim();
    const trimmedPass = (password || '').trim();

    if (!trimmedUser || !trimmedPass) {
      return { success: false, message: 'Syötä käyttäjätunnus ja salasana.' };
    }

    const accounts = this._getAccounts();
    const userKey = trimmedUser.toLowerCase();
    const profile = accounts[userKey];

    if (!profile) {
      return { success: false, message: 'Käyttäjätunnusta ei löytynyt. Luo uusi tili alta!' };
    }

    if (profile.password !== trimmedPass) {
      return { success: false, message: 'Väärä salasana! Yritä uudelleen.' };
    }

    profile.lastPlayed = new Date().toISOString();
    accounts[userKey] = profile;
    this._saveAccounts(accounts);

    this.currentAccount = profile;
    localStorage.setItem(this.currentAccountKey, userKey);

    return { success: true, message: `Kirjauduttu sisään! Tervetuloa takaisin, ${profile.username}!`, profile };
  }

  /**
   * Saves current gameplay state to the logged-in user profile
   */
  saveCurrentProfile(gameState) {
    if (!this.currentAccount) return false;

    const accounts = this._getAccounts();
    const userKey = this.currentAccount.username.toLowerCase();

    if (!accounts[userKey]) {
      accounts[userKey] = this.currentAccount;
    }

    accounts[userKey].saveData = gameState;
    accounts[userKey].lastPlayed = new Date().toISOString();
    this.currentAccount = accounts[userKey];

    this._saveAccounts(accounts);
    return true;
  }

  /**
   * Loads saved game state from current account
   */
  loadCurrentProfile() {
    if (!this.currentAccount) return null;
    return this.currentAccount.saveData || null;
  }

  clearCurrentProfileSave() {
    if (!this.currentAccount) return false;
    const accounts = this._getAccounts();
    const userKey = this.currentAccount.username.toLowerCase();
    if (!accounts[userKey]) return false;
    accounts[userKey].saveData = null;
    accounts[userKey].lastPlayed = new Date().toISOString();
    this.currentAccount = accounts[userKey];
    this._saveAccounts(accounts);
    return true;
  }

  /**
   * Logs out of current account
   */
  logout() {
    this.currentAccount = null;
    localStorage.removeItem(this.currentAccountKey);
  }

  isLoggedIn() {
    return this.currentAccount !== null;
  }

  getCurrentUsername() {
    return this.currentAccount ? this.currentAccount.username : null;
  }
}
