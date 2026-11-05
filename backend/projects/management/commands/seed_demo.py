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
from projects.models import Comment, Project, Task

DEMO_PASSWORD = "TeamFlow-demo-2026"
DEMO_ORG = "Acme Studio"
USERS = [
    ("owner@demo.teamflow.dev", "Olivia Owner", Membership.Role.OWNER),
    ("admin@demo.teamflow.dev", "Adam Admin", Membership.Role.ADMIN),
    ("member@demo.teamflow.dev", "Mia Member", Membership.Role.MEMBER),
    ("dev@demo.teamflow.dev", "Diego Developer", Membership.Role.MEMBER),
]

# (title, status, priority, assignee index, due in days or None)
WEBSITE_TASKS = [
    ("Audit current site analytics", "completed", "medium", 1, -6),
    ("Write homepage copy", "completed", "high", 2, -2),
    ("Design new navigation", "in_progress", "high", 2, 3),
    ("Build responsive header component", "in_progress", "medium", 3, 5),
    ("Set up preview deployments", "todo", "low", 3, 10),
    ("Accessibility review of forms", "todo", "urgent", 1, -1),
    ("Plan launch announcement", "todo", "medium", None, 14),
]
MOBILE_TASKS = [
    ("Define MVP feature list", "completed", "high", 0, -10),
    ("Choose push notification provider", "in_progress", "medium", 3, 2),
    ("Prototype onboarding screens", "todo", "high", 2, 7),
    ("Draft privacy policy update", "todo", "low", None, None),
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

        today = timezone.localdate()
        website = self._project(org, owner, design, "Website redesign", "Refresh the marketing site.", today + timedelta(days=21))
        mobile = self._project(org, users[1], engineering, "Mobile app MVP", "First release of the iOS/Android app.", today + timedelta(days=45))
        self._tasks(website, WEBSITE_TASKS, users, today)
        self._tasks(mobile, MOBILE_TASKS, users, today)

        legacy = self._project(org, owner, None, "2025 brand refresh", "Wrapped up last year.", None)
        legacy.status = Project.Status.ARCHIVED
        legacy.save(update_fields=["status"])
        log_activity(org, owner, "project_archived", f'archived the project "{legacy.name}"', legacy)

        nav = Task.objects.get(project=website, title="Design new navigation")
        Comment.objects.create(task=nav, author=users[1], body="Can we keep the search in the header on mobile?")
        Comment.objects.create(task=nav, author=users[2], body="Yes — I'll share two options by Thursday.")
        log_activity(org, users[2], "commented", f'commented on "{nav.title}"', website, nav)

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
    def _tasks(project, rows, users, today):
        positions = {}
        for title, task_status, priority, assignee, due in rows:
            position = positions.get(task_status, 0)
            positions[task_status] = position + 1
            task = Task.objects.create(
                project=project,
                title=title,
                status=task_status,
                priority=priority,
                assignee=users[assignee] if assignee is not None else None,
                due_date=today + timedelta(days=due) if due is not None else None,
                position=position,
                created_by=users[0],
                completed_at=timezone.now() if task_status == Task.Status.COMPLETED else None,
            )
            message = f'created the task "{title}"'
            if task.assignee:
                message += f" and assigned it to {task.assignee.full_name}"
            log_activity(project.organization, users[0], "task_created", message, project, task)
