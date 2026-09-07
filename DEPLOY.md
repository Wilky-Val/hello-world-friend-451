# Guide de déploiement sur Netlify + Supabase

Ce guide explique comment héberger ce projet POS sur **Netlify** avec ta propre base de données **Supabase**.

---

## 1. Prérequis

Installe sur ton ordinateur :

- [Node.js](https://nodejs.org) (version 20 recommandée)
- [Git](https://git-scm.com)
- Un éditeur de code (VS Code par exemple)

---

## 2. Créer un projet Supabase

1. Va sur [https://supabase.com](https://supabase.com) et connecte-toi.
2. Clique sur **New project**.
3. Donne un nom au projet, choisis une région proche de tes utilisateurs, puis clique sur **Create new project**.
4. Attends que le projet soit prêt.

---

## 3. Créer les tables

1. Dans le menu de gauche, clique sur **SQL Editor**.
2. Clique sur **New query**.
3. Copie-colle le contenu du fichier `init_supabase.sql` (à la racine du projet).
4. Clique sur **Run**.

Cela crée toutes les tables, les fonctions, les politiques de sécurité et le bucket de stockage.

---

## 4. Configurer l’authentification

1. Va dans **Authentication > Providers**.
2. Active **Email**.
3. Dans **Authentication > Settings**, désactive l’inscription libre si tu veux que seul le super admin crée les comptes entreprise.
4. Va dans **Authentication > Policies** et assure-toi que la confirmation par email est désactivée si tu veux des comptes actifs immédiatement.

---

## 5. Créer le super administrateur

1. Va dans **Authentication > Users**.
2. Clique sur **Add user > Create new user**.
3. Saisis l’email et le mot de passe du super administrateur.
4. Clique sur la ligne de l’utilisateur créé et copie son **UUID** (champ `id`).
5. Retourne dans **SQL Editor** et exécute :

```sql
INSERT INTO public.platform_admins (user_id) VALUES ('<UUID_COPIÉ>');
```

Remplace `<UUID_COPIÉ>` par l’UUID de l’utilisateur.

---

## 6. Récupérer les clés Supabase

1. Va dans **Project Settings > API**.
2. Copie :
   - **URL** → `SUPABASE_URL` et `VITE_SUPABASE_URL`
   - **anon public** → `SUPABASE_PUBLISHABLE_KEY` et `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **Project API keys > service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`
   - **Project ID** (dans l’URL ou les settings) → `SUPABASE_PROJECT_ID` et `VITE_SUPABASE_PROJECT_ID`

**Ne partage jamais la `SUPABASE_SERVICE_ROLE_KEY`.**

---

## 7. Préparer le projet en local

1. Ouvre le dossier du projet dans ton éditeur de code.
2. Crée un fichier `.env` à la racine en copiant `.env.example` :

```bash
cp .env.example .env
```

3. Remplis les variables avec les valeurs récupérées à l’étape 6.
4. Installe les dépendances :

```bash
npm install
```

5. Lance le serveur de développement :

```bash
npm run dev
```

L’application est alors accessible sur `http://localhost:8080`.

---

## 8. Déployer sur Netlify

### Méthode A : via le CLI Netlify (recommandée)

1. Installe le CLI Netlify :

```bash
npm install -g netlify-cli
```

2. Connecte-toi :

```bash
netlify login
```

3. Dans le dossier du projet, initialise le site :

```bash
netlify init
```

4. Déploie :

```bash
netlify deploy --prod
```

### Méthode B : via Git (GitHub + Netlify)

1. Crée un dépôt sur GitHub.
2. Pousse le code :

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<utilisateur>/<depot>.git
git push -u origin main
```

3. Va sur [https://app.netlify.com](https://app.netlify.com) et clique sur **Add new site > Import an existing project**.
4. Choisis GitHub et sélectionne ton dépôt.
5. Configure le build :
   - Build command : `NITRO_PRESET=netlify npm run build`
   - Publish directory : `.netlify/dist`
6. Clique sur **Show advanced > New variable** et ajoute toutes les variables du fichier `.env` (sans le préfixe `VITE_` pour les clés serveur, avec `VITE_` pour les clés client).
7. Clique sur **Deploy site**.

---

## 9. Variables d’environnement Netlify obligatoires

Dans **Site settings > Environment variables**, ajoute :

| Nom | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | URL Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clé anon publique |
| `VITE_SUPABASE_PROJECT_ID` | ID du projet |
| `SUPABASE_URL` | URL Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | clé anon publique |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service role |
| `SUPABASE_PROJECT_ID` | ID du projet |

Redéploie le site après avoir ajouté les variables.

---

## 10. Après le déploiement

1. Ouvre l’URL Netlify.
2. Connecte-toi avec l’email et le mot de passe du super administrateur.
3. Va dans **Super Admin** pour créer une entreprise.
4. Déconnecte-toi, puis connecte-toi avec le compte entreprise créé.
5. Configure l’entreprise, le stock, et commence à utiliser la caisse.

---

## Besoin d’aide ?

Si le déploiement ne fonctionne pas, vérifie :

- Les variables d’environnement sont bien toutes renseignées.
- Le fichier `init_supabase.sql` a bien été exécuté sans erreur.
- Le super administrateur est bien inséré dans `public.platform_admins`.
