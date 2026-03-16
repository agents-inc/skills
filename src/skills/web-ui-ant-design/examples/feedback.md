# Ant Design -- Feedback Components Examples

> Modal, Drawer, message, notification, and Popconfirm patterns using App.useApp(). See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [Forms & Validation](form.md)
- [Setup & Theme Configuration](setup.md)
- [Tables & Data Display](table.md)

---

## Using App Component and useApp Hook

```tsx
import { App, Button, Space } from "antd";

// Wrap your application root with <App> component
function FeedbackDemo() {
  const { message, notification, modal } = App.useApp();

  const showMessage = () => {
    message.success("Operation completed successfully");
  };

  const showNotification = () => {
    notification.open({
      message: "New Update Available",
      description: "Version 2.0 is ready to install.",
      placement: "topRight",
    });
  };

  const showConfirm = () => {
    modal.confirm({
      title: "Delete this item?",
      content: "This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        await deleteItem();
        message.success("Item deleted");
      },
    });
  };

  return (
    <Space>
      <Button onClick={showMessage}>Show Message</Button>
      <Button onClick={showNotification}>Show Notification</Button>
      <Button danger onClick={showConfirm}>
        Delete Item
      </Button>
    </Space>
  );
}
export { FeedbackDemo };
```

**Why good:** useApp() reads ConfigProvider context (theme, locale, prefixCls), all feedback renders consistently with the current theme.

```tsx
// BAD: Using static methods
import { message, Modal } from "antd";

function BadFeedback() {
  message.success("Saved!"); // Ignores ConfigProvider theme/locale
  Modal.confirm({ title: "Sure?" }); // Ignores ConfigProvider context
}
```

**Why bad:** Static methods create their own React root outside ConfigProvider, resulting in wrong theme colors, missing locale translations, and broken CSS variable references.

---

## Declarative Modal

```tsx
import { useState } from "react";
import { Modal, Button, Form, Input } from "antd";

function EditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm();

  const handleOk = async () => {
    const values = await form.validateFields();
    await saveData(values);
    onClose();
  };

  return (
    <Modal
      title="Edit Profile"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}
export { EditModal };
```

**When to use:** Declarative Modal (open prop) for form modals and complex content, modal.confirm() via useApp for simple confirmation dialogs.

---

## Settings Drawer

```tsx
import { useState } from "react";
import { Drawer, Form, Input, Switch, Select, Button, Space, App } from "antd";
import { SettingOutlined } from "@ant-design/icons";

interface SettingsFormValues {
  displayName: string;
  emailNotifications: boolean;
  language: string;
  timezone: string;
}

const DRAWER_WIDTH = 480;

function SettingsDrawer() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<SettingsFormValues>();
  const { message } = App.useApp();

  const handleSave = async () => {
    const values = await form.validateFields();
    await updateSettings(values);
    message.success("Settings saved");
    setOpen(false);
  };

  return (
    <>
      <Button icon={<SettingOutlined />} onClick={() => setOpen(true)}>
        Settings
      </Button>
      <Drawer
        title="Settings"
        width={DRAWER_WIDTH}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSave}>
              Save
            </Button>
          </Space>
        }
      >
        <Form<SettingsFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            emailNotifications: true,
            language: "en",
            timezone: "UTC",
          }}
        >
          <Form.Item
            name="displayName"
            label="Display Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="emailNotifications"
            label="Email Notifications"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item name="language" label="Language">
            <Select
              options={[
                { label: "English", value: "en" },
                { label: "Chinese", value: "zh" },
                { label: "Japanese", value: "ja" },
              ]}
            />
          </Form.Item>
          <Form.Item name="timezone" label="Timezone">
            <Select
              showSearch
              options={[
                { label: "UTC", value: "UTC" },
                { label: "US/Eastern", value: "US/Eastern" },
                { label: "US/Pacific", value: "US/Pacific" },
                { label: "Asia/Tokyo", value: "Asia/Tokyo" },
                { label: "Europe/London", value: "Europe/London" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
export { SettingsDrawer };
```
