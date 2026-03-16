# Ant Design -- Forms & Validation Examples

> Form patterns with TypeScript generics, validation rules, dynamic fields, and modal forms. See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [Core Setup & Theming](core.md)
- [Feedback Components](feedback.md)
- [Tables & Data Display](table.md)

---

## Complex Form with Dependencies and Async Validation

```tsx
import { Form, Input, Select, InputNumber, Divider, Button, App } from "antd";
import type { Rule } from "antd/es/form";

interface RegistrationFormValues {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: "personal" | "business";
  companyName?: string;
  employeeCount?: number;
}

const MIN_PASSWORD_LENGTH = 8;
const MAX_COMPANY_NAME_LENGTH = 100;

// Async validator to check username availability
const checkUsernameAvailable = async (_: Rule, value: string) => {
  if (!value) return;
  const response = await fetch(`/api/check-username?username=${value}`);
  const { available } = await response.json();
  if (!available) {
    throw new Error("Username is already taken");
  }
};

function RegistrationForm() {
  const [form] = Form.useForm<RegistrationFormValues>();
  const { message } = App.useApp();
  const accountType = Form.useWatch("accountType", form);

  const handleFinish = async (values: RegistrationFormValues) => {
    try {
      await registerUser(values);
      message.success("Registration successful!");
    } catch {
      message.error("Registration failed. Please try again.");
    }
  };

  return (
    <Form<RegistrationFormValues>
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ accountType: "personal" }}
    >
      <Form.Item
        name="username"
        label="Username"
        hasFeedback
        rules={[
          { required: true, message: "Username is required" },
          { min: 3, max: 20, message: "Username must be 3-20 characters" },
          {
            pattern: /^[a-zA-Z0-9_]+$/,
            message: "Only letters, numbers, and underscores",
          },
          { validator: checkUsernameAvailable },
        ]}
        validateDebounce={500}
      >
        <Input placeholder="Choose a username" />
      </Form.Item>

      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, message: "Email is required" },
          { type: "email", message: "Enter a valid email" },
        ]}
      >
        <Input placeholder="you@example.com" />
      </Form.Item>

      <Form.Item
        name="password"
        label="Password"
        rules={[
          { required: true, message: "Password is required" },
          {
            min: MIN_PASSWORD_LENGTH,
            message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          },
        ]}
      >
        <Input.Password placeholder="Enter password" />
      </Form.Item>

      {/* Password confirmation with dependency on 'password' field */}
      <Form.Item
        name="confirmPassword"
        label="Confirm Password"
        dependencies={["password"]}
        rules={[
          { required: true, message: "Please confirm your password" },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue("password") === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error("Passwords do not match"));
            },
          }),
        ]}
      >
        <Input.Password placeholder="Confirm password" />
      </Form.Item>

      <Divider />

      <Form.Item
        name="accountType"
        label="Account Type"
        rules={[{ required: true }]}
      >
        <Select
          options={[
            { label: "Personal", value: "personal" },
            { label: "Business", value: "business" },
          ]}
        />
      </Form.Item>

      {/* Conditional fields based on accountType */}
      {accountType === "business" && (
        <>
          <Form.Item
            name="companyName"
            label="Company Name"
            rules={[
              { required: true, message: "Company name is required" },
              { max: MAX_COMPANY_NAME_LENGTH },
            ]}
          >
            <Input placeholder="Your company name" />
          </Form.Item>
          <Form.Item
            name="employeeCount"
            label="Number of Employees"
            rules={[{ required: true, message: "Employee count is required" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
        </>
      )}

      <Form.Item>
        <Button type="primary" htmlType="submit" block>
          Register
        </Button>
      </Form.Item>
    </Form>
  );
}
export { RegistrationForm };
```

---

## Modal Form Pattern

```tsx
import { useState } from "react";
import { Modal, Form, Input, Select, Button, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";

interface InviteFormValues {
  email: string;
  role: "admin" | "member" | "viewer";
  message?: string;
}

function InviteMemberModal() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<InviteFormValues>();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await sendInvite(values);
      message.success(`Invitation sent to ${values.email}`);
      form.resetFields();
      setOpen(false);
    } catch {
      // validateFields rejection is handled by Form UI
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setOpen(false);
  };

  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setOpen(true)}
      >
        Invite Member
      </Button>
      <Modal
        title="Invite Team Member"
        open={open}
        onOk={handleOk}
        onCancel={handleCancel}
        confirmLoading={loading}
        destroyOnClose
      >
        <Form<InviteFormValues>
          form={form}
          layout="vertical"
          initialValues={{ role: "member" }}
        >
          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Enter a valid email" },
            ]}
          >
            <Input placeholder="colleague@company.com" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Admin", value: "admin" },
                { label: "Member", value: "member" },
                { label: "Viewer", value: "viewer" },
              ]}
            />
          </Form.Item>
          <Form.Item name="message" label="Personal Message">
            <Input.TextArea rows={3} placeholder="Optional welcome message" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
export { InviteMemberModal };
```

---

## Dynamic Fields with Form.List

```tsx
import { Form, Input, Button, Space } from "antd";
import { PlusOutlined, MinusCircleOutlined } from "@ant-design/icons";

interface TeamFormValues {
  teamName: string;
  members: Array<{ name: string; email: string }>;
}

function TeamForm() {
  const [form] = Form.useForm<TeamFormValues>();

  return (
    <Form<TeamFormValues> form={form} layout="vertical" onFinish={console.log}>
      <Form.Item name="teamName" label="Team Name" rules={[{ required: true }]}>
        <Input />
      </Form.Item>

      <Form.List
        name="members"
        rules={[
          {
            validator: async (_, members: TeamFormValues["members"]) => {
              if (!members || members.length < 1) {
                return Promise.reject(new Error("At least 1 member required"));
              }
            },
          },
        ]}
      >
        {(fields, { add, remove }, { errors }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <Space
                key={key}
                style={{ display: "flex", marginBottom: 8 }}
                align="baseline"
              >
                <Form.Item
                  {...restField}
                  name={[name, "name"]}
                  rules={[{ required: true, message: "Member name required" }]}
                >
                  <Input placeholder="Member name" />
                </Form.Item>
                <Form.Item
                  {...restField}
                  name={[name, "email"]}
                  rules={[
                    {
                      required: true,
                      type: "email",
                      message: "Valid email required",
                    },
                  ]}
                >
                  <Input placeholder="Email" />
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(name)} />
              </Space>
            ))}
            <Form.Item>
              <Button
                type="dashed"
                onClick={() => add()}
                icon={<PlusOutlined />}
                block
              >
                Add Member
              </Button>
            </Form.Item>
            <Form.ErrorList errors={errors} />
          </>
        )}
      </Form.List>

      <Form.Item>
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </Form.Item>
    </Form>
  );
}
export { TeamForm };
```

---

## Form.useWatch for Reactive Fields

```tsx
import { Form, Input, Select, InputNumber } from "antd";

function PricingForm() {
  const [form] = Form.useForm();
  const planType = Form.useWatch("planType", form);

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="planType" label="Plan">
        <Select
          options={[
            { label: "Free", value: "free" },
            { label: "Pro", value: "pro" },
            { label: "Enterprise", value: "enterprise" },
          ]}
        />
      </Form.Item>

      {/* Conditionally show fields based on watched value */}
      {planType !== "free" && (
        <Form.Item
          name="seats"
          label="Number of Seats"
          rules={[{ required: true }]}
        >
          <InputNumber min={1} style={{ width: "100%" }} />
        </Form.Item>
      )}
    </Form>
  );
}
export { PricingForm };
```

**When to use:** Form.useWatch is ideal for conditional rendering based on field values, avoids unnecessary re-renders compared to onValuesChange.

---

## Typed Create Form with Validation

```tsx
import { Form, Input, Select, Button, InputNumber, App } from "antd";
import type { Rule } from "antd/es/form";

interface CreateUserFormValues {
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  age: number;
}

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MIN_AGE = 18;
const MAX_AGE = 120;

const NAME_RULES: Rule[] = [
  { required: true, message: "Name is required" },
  {
    min: MIN_NAME_LENGTH,
    max: MAX_NAME_LENGTH,
    message: `Name must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters`,
  },
];

const EMAIL_RULES: Rule[] = [
  { required: true, message: "Email is required" },
  { type: "email", message: "Enter a valid email" },
];

function CreateUserForm({
  onSubmit,
}: {
  onSubmit: (values: CreateUserFormValues) => Promise<void>;
}) {
  const [form] = Form.useForm<CreateUserFormValues>();
  const { message } = App.useApp();

  const handleFinish = async (values: CreateUserFormValues) => {
    try {
      await onSubmit(values);
      message.success("User created successfully");
      form.resetFields();
    } catch {
      message.error("Failed to create user");
    }
  };

  return (
    <Form<CreateUserFormValues>
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ role: "viewer" }}
    >
      <Form.Item name="name" label="Name" rules={NAME_RULES}>
        <Input placeholder="Enter name" />
      </Form.Item>

      <Form.Item name="email" label="Email" rules={EMAIL_RULES}>
        <Input placeholder="Enter email" />
      </Form.Item>

      <Form.Item name="role" label="Role" rules={[{ required: true }]}>
        <Select
          options={[
            { label: "Admin", value: "admin" },
            { label: "Editor", value: "editor" },
            { label: "Viewer", value: "viewer" },
          ]}
        />
      </Form.Item>

      <Form.Item
        name="age"
        label="Age"
        rules={[
          { required: true, message: "Age is required" },
          {
            type: "number",
            min: MIN_AGE,
            max: MAX_AGE,
            message: `Age must be ${MIN_AGE}-${MAX_AGE}`,
          },
        ]}
      >
        <InputNumber style={{ width: "100%" }} />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit">
          Create User
        </Button>
      </Form.Item>
    </Form>
  );
}
export { CreateUserForm };
export type { CreateUserFormValues };
```
