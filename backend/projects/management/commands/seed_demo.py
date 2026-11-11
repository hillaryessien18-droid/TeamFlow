"""Create a demo organization with one user per role, teams, projects and tasks.

    python manage.py seed_demo           # create (skips if the demo org already exists)
    python manage.py seed_demo --reset   # delete the demo org and recreate it
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from organizations.models import Membership, Organization, Team
from projects.activity import log_activity
from projects.models import Comment, Label, Project, Task

DEMO_PASSWORD = "TeamFlow-demo-2026"  # NOSONAR - public demo credential, documented in README
DEMO_ORG = "Acme Studio"
USERS = [
    ("owner@demo.teamflow.dev", "Olivia Owner", Membership.Role.OWNER),
    ("admin@demo.teamflow.dev", "Adam Admin", Membership.Role.ADMIN),
    ("member@demo.teamflow.dev", "Mia Member", Membership.Role.MEMBER),
    ("dev@demo.teamflow.dev", "Diego Developer", Membership.Role.MEMBER),
]

# (name, color)
LABELS = [
    ("Bug", "red"),
    ("Feature", "emerald"),
    ("Design", "violet"),
    ("Frontend", "sky"),
    ("Backend", "amber"),
    ("Research", "slate"),
    ("Content", "rose"),
]

# (title, status, priority, assignee index, due in days or None, labels, description)
WEBSITE_TASKS = [
    ("Audit current site analytics", "completed", "medium", 1, -6, ["Research"],
     "Pull the last 12 months of traffic and conversion data and flag the five worst-performing pages."),
    ("Write homepage copy", "completed", "high", 2, -2, ["Content"],
     "Hero, feature sections and FAQ. Keep the tone friendly and under 400 words in total."),
    ("Design new navigation", "in_progress", "high", 2, 3, ["Design"],
     "Simplify the top navigation to five items and design the mobile menu.\n\nAcceptance criteria:\n- Works with keyboard only\n- Search stays visible on mobile"),
    ("Build responsive header component", "in_progress", "medium", 3, 5, ["Frontend", "Feature"],
     "Implement the new header from the design file, including the sticky behaviour on scroll."),
    ("Fix broken links in the footer", "in_progress", "high", 0, 1, ["Bug", "Frontend"],
     "The Careers and Press links return 404 since the CMS migration."),
    ("Set up preview deployments", "todo", "low", 3, 10, ["Backend"],
     "Every pull request should get its own preview URL so design can review changes."),
    ("Accessibility review of forms", "todo", "urgent", 1, -1, ["Frontend"],
     "Check labels, focus order and error messages on the contact and newsletter forms (WCAG 2.2 AA)."),
    ("Plan launch announcement", "todo", "medium", 0, 14, ["Content"],
     "Blog post, newsletter and social posts for launch day."),
    ("Compress hero images", "todo", "low", None, None, ["Frontend"], ""),
]
MOBILE_TASKS = [
    ("Define MVP feature list", "completed", "high", 0, -10, ["Research"],
     "Agree on the must-have features for the first release with the founders."),
    ("Choose push notification provider", "in_progress", "medium", 3, 2, ["Backend", "Research"],
     "Compare pricing, delivery reports and SDK size for the shortlisted providers."),
    ("Set up crash reporting", "in_progress", "medium", 3, 4, ["Backend"], ""),
    ("Prototype onboarding screens", "todo", "high", 2, 7, ["Design"],
     "Three screens: welcome, permissions and account creation. Test with five users."),
    ("Review App Store guidelines", "todo", "medium", 0, 6, ["Research"],
     "Make sure sign-in, payments and data collection meet the current review rules."),
    ("Login fails on Android 12", "todo", "urgent", 3, 0, ["Bug"],
     "Reported by beta testers: the app freezes after tapping Log in on Android 12 devices."),
    ("Draft privacy policy update", "todo", "low", None, None, ["Content"], ""),
]
PORTAL_TASKS = [
    ("Interview five customers", "completed", "high", 0, -8, ["Research"],
     "Find out which account tasks people currently email support about."),
    ("Invoice history page", "in_progress", "high", 1, 4, ["Feature", "Frontend"],
     "List invoices with status and a PDF download link."),
    ("Single sign-on with Google", "todo", "medium", 3, 12, ["Feature", "Backend"], ""),
    ("Portal wireframes", "todo", "high", 2, 3, ["Design"],
     "Dashboard, invoices, team members and settings."),
    ("Write help-centre articles", "todo", "low", None, 20, ["Content"], ""),
]

# (task title, author index, body)
COMMENTS = [
    ("Design new navigation", 1, "Can we keep the search in the header on mobile?"),
    ("Design new navigation", 2, "Yes, I'll share two options by Thursday."),
    ("Fix broken links in the footer", 3, "The redirects file wasn't migrated. I can add it back if you want."),
    ("Fix broken links in the footer", 0, "Please do, thanks Diego."),
    ("Login fails on Android 12", 1, "I can reproduce it on a Pixel 5. Looks related to the biometric prompt."),
    ("Invoice history page", 0, "Let's show the last 24 months by default."),
]


class Command(BaseCommand):
    help = "Seed a demo organization with users, teams, projects and tasks."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete and recreate the demo organization.")

    @transaction.atomic
    def handle(self, *args, reset=False, **options):
        existing = Organization.objects.filter(name=DEMO_ORG, created_by__email=USERS[0][0])
        if existing.exists():
            if not reset:
                self.stdout.write(self.style.WARNING("Demo data already exists. Use --reset to recreate it."))
                return
            existing.delete()

        users = []
        for email, name, _role in USERS:
            user, created = User.objects.get_or_create(email=email, defaults={"full_name": name})
            if created:
                user.set_password(DEMO_PASSWORD)
                user.save()
            users.append(user)
        owner = users[0]

        org = Organization.objects.create(
            name=DEMO_ORG, description="A small product studio building web and mobile apps.", created_by=owner
        )
        for user, (_email, _name, role) in zip(users, USERS):
            Membership.objects.create(organization=org, user=user, role=role)
        log_activity(org, owner, "created", f'created the organization "{org.name}"')

        design = Team.objects.create(organization=org, name="Design", description="Product and visual design")
        design.members.set([users[1], users[2]])
        engineering = Team.objects.create(organization=org, name="Engineering", description="Web and mobile")
        engineering.members.set([users[1], users[3]])

        labels = {name: Label.objects.create(organization=org, name=name, color=color) for name, color in LABELS}

        today = timezone.localdate()
        website = self._project(
            org, owner, design, "Website redesign",
            "Refresh the marketing site with a new navigation, homepage and faster pages.", today + timedelta(days=21),
        )
        mobile = self._project(
            org, users[1], engineering, "Mobile app MVP",
            "First release of the iOS and Android app for existing customers.", today + timedelta(days=45),
        )
        portal = self._project(
            org, owner, engineering, "Customer portal",
            "Self-service portal where customers manage invoices, users and settings.", today + timedelta(days=60),
        )
        self._tasks(website, WEBSITE_TASKS, users, labels, today)
        self._tasks(mobile, MOBILE_TASKS, users, labels, today)
        self._tasks(portal, PORTAL_TASKS, users, labels, today)

        legacy = self._project(org, owner, None, "2025 brand refresh", "Wrapped up last year.", None)
        legacy.status = Project.Status.ARCHIVED
        legacy.save(update_fields=["status"])
        log_activity(org, owner, "project_archived", f'archived the project "{legacy.name}"', legacy)

        for title, author, body in COMMENTS:
            task = Task.objects.get(project__organization=org, title=title)
            Comment.objects.create(task=task, author=users[author], body=body)
            log_activity(org, users[author], "commented", f'commented on "{title}"', task.project, task)

        self.stdout.write(self.style.SUCCESS(f'Created "{DEMO_ORG}". Log in with any of these (password: {DEMO_PASSWORD}):'))
        for email, _name, role in USERS:
            self.stdout.write(f"  {role:<7} {email}")

    @staticmethod
    def _project(org, creator, team, name, description, due_date):
        project = Project.objects.create(
            organization=org, team=team, name=name, description=description, due_date=due_date, created_by=creator
        )
        log_activity(org, creator, "project_created", f'created the project "{name}"', project)
        return project

    @staticmethod
    def _tasks(project, rows, users, labels, today):
        positions = {}
        for title, task_status, priority, assignee, due, label_names, description in rows:
            position = positions.get(task_status, 0)
            positions[task_status] = position + 1
            task = Task.objects.create(
                project=project,
                title=title,
                description=description,
                status=task_status,
                priority=priority,
                assignee=users[assignee] if assignee is not None else None,
                due_date=today + timedelta(days=due) if due is not None else None,
                position=position,
                created_by=users[0],
                completed_at=timezone.now() if task_status == Task.Status.COMPLETED else None,
            )
            task.labels.set([labels[name] for name in label_names])
            message = f'created the task "{title}"'
            if task.assignee:
                message += f" and assigned it to {task.assignee.full_name}"
            log_activity(project.organization, users[0], "task_created", message, project, task)
