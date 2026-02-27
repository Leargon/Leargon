#### USER STORY 'Fallback admin creation on startup'
**AS** Léargon\
**IF** a valid e-mail-address and password is provided\
**I WANT** to create the fallback admin at startup, if there is none existing\
**SO THAT** there is always an admin-user, which can be used to login, when something got misconfigured and no-one has access or admin-rights

#### USER STORY 'Fallback admin update on startup'
**AS** Léargon\
**IF** a valid e-mail-address and password is provided\
**I WANT** to update the fallback admin at startup, if there is one existing\
**SO THAT** there is always an up-tp-date admin-user, which can be used to login, when something got misconfigured and no-one has access or admin-rights

#### USER STORY 'Initial Setup'
**AS THE** fallback admin\
**IF** I log in the first time\
**I WANT** to setup the supported locales, set the sort order and set the default language\
**SO THAT** keys can be created and locales can be used for names and descriptions

#### USER STORY 'Check supported locales'
**AS AN** admin\
**IF** \
**I WANT** to see all supported locales and their sort orders\
**SO THAT** I can check, if everything is setup fine

#### USER STORY 'Add supported locale'
**AS AN** admin\
**IF** \
**I WANT** to add a new supported locale and set the sort order\
**SO THAT** new locales can be used for names and descriptions

#### USER STORY 'Modify supported locale'
**AS AN** admin\
**IF** \
**I WANT** to change sort order of supported locales\
**SO THAT** locale are shown in a different order

#### USER STORY 'Delete supported locale'
**AS AN** admin\
**IF** the supported locale is not the default locale and is not in use by any existing translations\
**I WANT** to delete the supported locale\
**SO THAT** I can define, which supported languages can be used

#### USER STORY 'Check registered users'
**AS AN** admin\
**IF** \
**I WANT** to see all registered users with their roles and status\
**SO THAT** I can verify the users

#### USER STORY 'Add user'
**AS AN** admin\
**IF** Azure Entra ID is not configured\
**I WANT** to add a user, providing an e-mail-address, username, firstname, lastname and initial password\
**SO THAT** this user can login

#### USER STORY 'Disable registered user'
**AS AN** admin\
**IF** the user is enabled\
**I WANT** to disable a registered user\
**SO THAT** this user is not able to login again

#### USER STORY 'Enable registered user'
**AS AN** admin\
**IF** the user is disabled\
**I WANT** to enable a registered user\
**SO THAT** this user is able to login again

#### USER STORY 'Change password of a registered user'
**AS AN** admin\
**IF** Azure Entra ID is not configured\
**I WANT** to change the password without knowing the current password\
**SO THAT** the user can login with a newly set password, e.g. the user forgot his/her password

#### USER STORY 'Modify roles of a registered user'
**AS AN** admin\
**IF** \
**I WANT** to add or remove the role 'admin'\
**SO THAT** I can promote or demote a registered user to or from admin

#### USER STORY 'Delete a registered user'
**AS AN** admin\
**IF** the registered user is not assigned as owner or lead to a business entity, business process or an organisational unit\
**I WANT** to delete a registered user\
**SO THAT** I can cleanup, e.g. the user is not working for the company anymore

#### USER STORY 'Change password'
**AS A** logged in user\
**IF** \
**I WANT** to change my password by entering my old password for verification and set a new password (with double check)\
**SO THAT** I can log in with a new password

#### USER STORY 'Login'
**AS A** registered user\
**IF** Azure Entra ID is not configured\
**I WANT** to login with e-mail and password\
**SO THAT** I can use Léargon

#### USER STORY 'Sign up'
**AS A** non-registered user\
**IF** Azure Entra ID is not configured\
**I WANT** to sign up to Léargon using my e-mail-address, firstname, lastname and password\
**SO THAT** I can login and use Léargon

#### USER STORY 'Logout'
**AS A** logged in user\
**IF** \
**I WANT** to log out of Léargon\
**SO THAT** I need to login again

#### USER STORY 'Add user'
**AS AN** admin\
**IF** Azure Entra ID is configured\
**I WANT** to add a user, providing an e-mail-address, firstname and lastname\
**SO THAT** this user can login

#### USER STORY 'Login'
**AS A** registered user\
**IF** Azure Entra ID is configured\
**I WANT** to login with my Microsoft login credentials\
**SO THAT** I can use Léargon

#### USER STORY 'Sign up'
**AS A** non-registered user\
**IF** Azure Entra ID is configured\
**I WANT** to login with my Microsoft login credentials and create a registered user on-the-way\
**SO THAT** I can login and use Léargon

#### USER STORY 'Installation'
**AS AN** operator\
**IF** \
**I WANT** to deploy Léargon with frontend, backend, and database\
**SO THAT** the application can be used by users

#### USER STORY 'Azure Entra ID configuration'
**AS AN** operator\
**IF** an application in Azure Entra ID is existing with redirect URI <domain>/callback\
**I WANT** to configure Azure Entra ID login with tenant-id, client-id and redirect URI\
**SO THAT** user can login with their Microsoft credentials

#### USER STORY 'Add classification'
**AS AN** admin\
**IF** \
**I WANT** to add a new classification by providing a name, description and assignable to\
**SO THAT** owners can use the classification in business entities, domains, business processes and organisational units

#### USER STORY 'List classifications'
**AS A** logged in user\
**IF** \
**I WANT** to see all configured classifications, optionally filtered by the entity type they are assignable to\
**SO THAT** I can verify the configuration or find applicable classifications for an entity

#### USER STORY 'Modify classification'
**AS AN** admin\
**IF** \
**I WANT** modify name and description of the classification\
**SO THAT** it is up-to-date

#### USER STORY 'Delete classification'
**AS AN** admin\
**IF** \
**I WANT** to delete the classification along with all its values, automatically removing all assignments from entities, domains, processes and organisational units\
**SO THAT** the classification is not usable anymore

#### USER STORY 'Add Classification value'
**AS AN** admin\
**IF** \
**I WANT** to add a classification value to a classification by providing a code, name and description\
**SO THAT** owners can assign this value when classifying business entities, domains, processes and organisational units

#### USER STORY 'List classification values'
**AS AN** admin\
**IF** \
**I WANT** to list all classification values of a classification\
**SO THAT** I can verify the classification values

#### USER STORY 'Modify classification value'
**AS AN** admin\
**IF** \
**I WANT** to modify the name or the description of a classification value\
**SO THAT** classification value is up-to-date

#### USER STORY 'Delete classification value'
**AS AN** admin\
**IF** \
**I WANT** to delete the classification value, automatically removing all assignments of this value from entities, domains, processes and organisational units\
**SO THAT** the value cannot be used anymore